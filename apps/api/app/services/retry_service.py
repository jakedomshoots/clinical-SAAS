"""Retry service with exponential backoff and circuit breaker pattern.

Provides resilient communication with external services.
"""

from __future__ import annotations

import asyncio
import functools
import random
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any, TypeVar

T = TypeVar("T")


class CircuitState(str, Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class RetryStrategy(str, Enum):
    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    LINEAR = "linear"


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""

    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    jitter: bool = True
    retryable_exceptions: tuple[type[Exception], ...] = field(default_factory=lambda: (Exception,))
    on_retry: Callable[[Exception, int], None] | None = None
    on_exhausted: Callable[[Exception], None] | None = None


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""

    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    half_open_max_calls: int = 3
    success_threshold: int = 2


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker."""

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: str | None = None
    last_success_time: str | None = None
    total_calls: int = 0
    total_failures: int = 0
    total_successes: int = 0


class CircuitBreaker:
    """Circuit breaker for preventing cascade failures."""

    def __init__(self, config: CircuitBreakerConfig | None = None) -> None:
        self.config = config or CircuitBreakerConfig()
        self._stats = CircuitBreakerStats()
        self._half_open_calls = 0

    @property
    def stats(self) -> CircuitBreakerStats:
        return self._stats

    def can_execute(self) -> bool:
        """Check if execution is allowed."""
        if self._stats.state == CircuitState.CLOSED:
            return True

        if self._stats.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self._stats.last_failure_time:
                last_failure = datetime.fromisoformat(self._stats.last_failure_time)
                elapsed = (datetime.now(UTC) - last_failure).total_seconds()
                if elapsed >= self.config.recovery_timeout:
                    self._stats.state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    return True
            return False

        if self._stats.state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.config.half_open_max_calls

        return True

    def record_success(self) -> None:
        """Record a successful execution."""
        self._stats.total_calls += 1
        self._stats.total_successes += 1
        self._stats.success_count += 1
        self._stats.last_success_time = datetime.now(UTC).isoformat()

        if self._stats.state == CircuitState.HALF_OPEN:
            self._half_open_calls += 1
            if self._stats.success_count >= self.config.success_threshold:
                self._stats.state = CircuitState.CLOSED
                self._stats.failure_count = 0
                self._stats.success_count = 0

    def record_failure(self) -> None:
        """Record a failed execution."""
        self._stats.total_calls += 1
        self._stats.total_failures += 1
        self._stats.failure_count += 1
        self._stats.success_count = 0
        self._stats.last_failure_time = datetime.now(UTC).isoformat()

        if (
            self._stats.state == CircuitState.HALF_OPEN
            or self._stats.failure_count >= self.config.failure_threshold
        ):
            self._stats.state = CircuitState.OPEN

    async def execute(self, fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Execute function with circuit breaker protection."""
        if not self.can_execute():
            raise CircuitBreakerOpenError(
                f"Circuit breaker is OPEN. Last failure: {self._stats.last_failure_time}"
            )

        try:
            if asyncio.iscoroutinefunction(fn):
                result = await fn(*args, **kwargs)
            else:
                result = fn(*args, **kwargs)
            self.record_success()
            return result
        except Exception:
            self.record_failure()
            raise


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open."""

    pass


class RetryService:
    """Service for executing operations with retry logic."""

    def __init__(self) -> None:
        self._circuit_breakers: dict[str, CircuitBreaker] = {}

    def get_circuit_breaker(self, name: str) -> CircuitBreaker:
        """Get or create circuit breaker."""
        if name not in self._circuit_breakers:
            self._circuit_breakers[name] = CircuitBreaker()
        return self._circuit_breakers[name]

    async def execute_with_retry(
        self,
        fn: Callable[..., T],
        *args: Any,
        config: RetryConfig | None = None,
        circuit_breaker_name: str | None = None,
        **kwargs: Any,
    ) -> T:
        """Execute function with retry and optional circuit breaker."""
        config = config or RetryConfig()

        # Check circuit breaker if configured
        cb: CircuitBreaker | None = None
        if circuit_breaker_name:
            cb = self.get_circuit_breaker(circuit_breaker_name)
            if not cb.can_execute():
                raise CircuitBreakerOpenError(f"Circuit breaker '{circuit_breaker_name}' is OPEN")

        last_exception: Exception | None = None

        for attempt in range(1, config.max_attempts + 1):
            try:
                if asyncio.iscoroutinefunction(fn):
                    result = await fn(*args, **kwargs)
                else:
                    result = fn(*args, **kwargs)

                # Record success on circuit breaker
                if cb:
                    cb.record_success()

                return result

            except Exception as e:
                last_exception = e

                # Check if exception is retryable
                if not isinstance(e, config.retryable_exceptions):
                    if cb:
                        cb.record_failure()
                    raise

                # Don't retry on last attempt
                if attempt >= config.max_attempts:
                    break

                # Calculate delay
                delay = self._calculate_delay(config, attempt)

                # Call retry callback
                if config.on_retry:
                    config.on_retry(e, attempt)

                # Wait before retry
                await asyncio.sleep(delay)

        # All retries exhausted
        if cb:
            cb.record_failure()

        if config.on_exhausted and last_exception:
            config.on_exhausted(last_exception)

        if last_exception:
            raise last_exception
        raise RuntimeError("Retry exhausted but no exception captured")

    def _calculate_delay(self, config: RetryConfig, attempt: int) -> float:
        """Calculate delay before next retry."""
        if config.strategy == RetryStrategy.FIXED:
            delay = config.base_delay
        elif config.strategy == RetryStrategy.LINEAR:
            delay = config.base_delay * attempt
        else:  # EXPONENTIAL
            delay = config.base_delay * (2 ** (attempt - 1))

        # Cap at max delay
        delay = min(delay, config.max_delay)

        # Add jitter to prevent thundering herd
        if config.jitter:
            delay = delay * (0.5 + random.random() * 0.5)

        return delay

    def create_retry_decorator(
        self,
        config: RetryConfig | None = None,
        circuit_breaker_name: str | None = None,
    ) -> Callable:
        """Create a decorator for retry logic."""
        config = config or RetryConfig()

        def decorator(fn: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> T:
                return await self.execute_with_retry(
                    fn, *args, config=config, circuit_breaker_name=circuit_breaker_name, **kwargs
                )

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> T:
                # For sync functions, run in executor
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        self._sync_execute_with_retry,
                        fn,
                        args,
                        kwargs,
                        config,
                        circuit_breaker_name,
                    )
                    return future.result()

            if asyncio.iscoroutinefunction(fn):
                return async_wrapper
            return sync_wrapper

        return decorator

    def _sync_execute_with_retry(
        self,
        fn: Callable[..., T],
        args: tuple,
        kwargs: dict,
        config: RetryConfig,
        circuit_breaker_name: str | None,
    ) -> T:
        """Execute sync function with retry logic."""
        import time

        cb: CircuitBreaker | None = None
        if circuit_breaker_name:
            cb = self.get_circuit_breaker(circuit_breaker_name)
            if not cb.can_execute():
                raise CircuitBreakerOpenError(f"Circuit breaker '{circuit_breaker_name}' is OPEN")

        last_exception: Exception | None = None

        for attempt in range(1, config.max_attempts + 1):
            try:
                result = fn(*args, **kwargs)
                if cb:
                    cb.record_success()
                return result
            except Exception as e:
                last_exception = e
                if not isinstance(e, config.retryable_exceptions):
                    if cb:
                        cb.record_failure()
                    raise

                if attempt >= config.max_attempts:
                    break

                delay = self._calculate_delay(config, attempt)
                if config.on_retry:
                    config.on_retry(e, attempt)
                time.sleep(delay)

        if cb:
            cb.record_failure()
        if config.on_exhausted and last_exception:
            config.on_exhausted(last_exception)
        if last_exception:
            raise last_exception
        raise RuntimeError("Retry exhausted but no exception captured")


# Default retry configurations for different scenarios

RETRY_CONFIG_NETWORK = RetryConfig(
    max_attempts=5,
    base_delay=1.0,
    max_delay=30.0,
    strategy=RetryStrategy.EXPONENTIAL,
    retryable_exceptions=(ConnectionError, TimeoutError, OSError),
)

RETRY_CONFIG_API = RetryConfig(
    max_attempts=3,
    base_delay=2.0,
    max_delay=60.0,
    strategy=RetryStrategy.EXPONENTIAL,
    retryable_exceptions=(ConnectionError, TimeoutError),
)

RETRY_CONFIG_DATABASE = RetryConfig(
    max_attempts=3,
    base_delay=0.5,
    max_delay=10.0,
    strategy=RetryStrategy.EXPONENTIAL,
    retryable_exceptions=(ConnectionError,),
)

# Global retry service instance
retry_service = RetryService()


# Convenience decorators


def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    circuit_breaker: str | None = None,
) -> Callable:
    """Decorator for adding retry logic to functions."""
    config = RetryConfig(
        max_attempts=max_attempts,
        base_delay=base_delay,
    )
    return retry_service.create_retry_decorator(
        config=config,
        circuit_breaker_name=circuit_breaker,
    )


def with_network_retry(circuit_breaker: str | None = None) -> Callable:
    """Decorator for network operations with aggressive retry."""
    return retry_service.create_retry_decorator(
        config=RETRY_CONFIG_NETWORK,
        circuit_breaker_name=circuit_breaker,
    )


def with_api_retry(circuit_breaker: str | None = None) -> Callable:
    """Decorator for API calls with standard retry."""
    return retry_service.create_retry_decorator(
        config=RETRY_CONFIG_API,
        circuit_breaker_name=circuit_breaker,
    )
