import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import type { Patient } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@concierge-os/shared';

interface SearchablePatientPickerProps {
  patients?: Patient[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function SearchablePatientPicker({
  patients,
  value,
  onChange,
  placeholder = 'Select patient...',
  required = false,
}: SearchablePatientPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useApi();

  // Debounce search term to avoid hitting the API on every keypress
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Query selected patient details to display their name when dropdown is closed
  const { data: selectedPatient } = useQuery({
    queryKey: ['patient-picker-selected', value],
    queryFn: () => api.get<Patient>(ROUTES.PATIENT(value)),
    enabled: Boolean(value),
  });

  // Query database dynamically for search query matching
  const { data: patientsData } = useQuery({
    queryKey: ['patient-picker-search', debouncedSearch],
    queryFn: () =>
      api.get<{ data: Patient[]; total: number }>(
        `/patients?search=${encodeURIComponent(debouncedSearch)}&page=1&page_size=50`
      ),
    enabled: isOpen,
  });

  // Determine display label and results
  const displayPatient = selectedPatient || (patients ? patients.find((p) => p.id === value) : null);
  const filteredPatients = patientsData
    ? patientsData.data
    : patients
    ? patients.filter((p) =>
        `${p.first_name} ${p.last_name} ${p.mrn}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for HTML form validation */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        className="sr-only h-0 w-0"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-sm border border-border bg-canvas px-3 py-2 text-left text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
      >
        <span className={displayPatient ? 'text-ink font-medium' : 'text-ink-faint'}>
          {displayPatient
            ? `${displayPatient.last_name}, ${displayPatient.first_name}`
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-muted" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-canvas-raised shadow-lg">
          <div className="sticky top-0 flex items-center border-b border-border bg-canvas-raised px-3 py-2">
            <Search className="mr-2 h-4 w-4 text-ink-faint" />
            <input
              type="text"
              autoFocus
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-small text-ink placeholder:text-ink-faint outline-none"
            />
          </div>
          <div className="py-1">
            {filteredPatients.length === 0 ? (
              <div className="px-3 py-2 text-center text-small text-ink-faint">
                No patients found
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const isSelected = patient.id === value;
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      onChange(patient.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-small hover:bg-canvas-sunk ${
                      isSelected ? 'bg-accent-soft text-accent font-medium' : 'text-ink-secondary'
                    }`}
                  >
                    <span>
                      {patient.last_name}, {patient.first_name}
                      <span className="ml-2 text-micro text-ink-muted font-mono">
                        {patient.mrn}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
