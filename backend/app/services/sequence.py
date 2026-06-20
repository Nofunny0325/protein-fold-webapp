import re
from fastapi import HTTPException

AA = set("ACDEFGHIKLMNPQRSTVWYBXZJUO")
CHAIN_SEPARATOR = ":"
FASTA_HEADER = re.compile(r"^>.*$", re.MULTILINE)


def normalize_sequence(raw: str) -> str:
    cleaned = FASTA_HEADER.sub("", raw).replace(" ", "").replace("\n", "").replace("\r", "").upper()
    return cleaned


def validate_protein_sequence(raw: str, max_len: int) -> str:
    sequence = normalize_sequence(raw)
    if not sequence:
        raise HTTPException(status_code=422, detail="Sequence is empty.")
    invalid = sorted(set(sequence) - AA - {CHAIN_SEPARATOR})
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid amino-acid symbols: {''.join(invalid)}")
    chains = sequence.split(CHAIN_SEPARATOR)
    if any(not chain for chain in chains):
        raise HTTPException(status_code=422, detail="Complex sequences must use non-empty chains separated by ':'.")
    if len(sequence) > max_len:
        raise HTTPException(status_code=413, detail=f"Sequence exceeds limit of {max_len} residues.")
    return sequence


def to_fasta(name: str, sequence: str) -> str:
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", name or "query")
    lines = [sequence[i : i + 80] for i in range(0, len(sequence), 80)]
    return f">{safe_name}\n" + "\n".join(lines) + "\n"
