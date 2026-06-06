CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def neutralize_csv_formula(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(CSV_FORMULA_PREFIXES):
        return f"'{text}"
    return text
