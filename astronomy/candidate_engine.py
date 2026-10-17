"""Transparent triage scoring for observation records.

Scores prioritize human review. They are not probabilities and do not confirm
that an object is a planet, star, or new discovery.
"""
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass(frozen=True)
class Observation:
    candidate_id: str
    signal_type: str
    signal_to_noise: float
    data_quality: float
    repeatability: float
    known_object_match: Optional[bool] = None


@dataclass(frozen=True)
class CandidateResult:
    candidate_id: str
    score: int
    priority: str
    reasons: tuple[str, ...]
    caveats: tuple[str, ...]

    def to_dict(self):
        result = asdict(self)
        result["reasons"] = list(self.reasons)
        result["caveats"] = list(self.caveats)
        return result


def score_candidate(obs: Observation) -> CandidateResult:
    """Return a deterministic 0-100 review priority from normalized inputs."""
    if not obs.candidate_id.strip():
        raise ValueError("candidate_id must not be empty")
    if obs.signal_type not in {"transit", "stellar_variability", "transient", "other"}:
        raise ValueError("unsupported signal_type")
    if obs.signal_to_noise < 0:
        raise ValueError("signal_to_noise must be non-negative")
    for field_name, value in (("data_quality", obs.data_quality), ("repeatability", obs.repeatability)):
        if not 0 <= value <= 1:
            raise ValueError(f"{field_name} must be between 0 and 1")

    snr_component = min(obs.signal_to_noise / 15.0, 1.0) * 40
    quality_component = obs.data_quality * 30
    repeat_component = obs.repeatability * 30
    score = round(snr_component + quality_component + repeat_component)
    reasons = [
        f"Signal-to-noise contribution: {snr_component:.1f}/40",
        f"Data-quality contribution: {quality_component:.1f}/30",
        f"Repeatability contribution: {repeat_component:.1f}/30",
    ]
    caveats = [
        "Score is a triage heuristic, not a calibrated probability.",
        "A high score does not establish an astronomical object or a new discovery.",
        "Independent validation and source/catalogue cross-matching are required.",
    ]
    if obs.known_object_match is True:
        score = max(0, score - 25)
        reasons.append("Known-object match reported: novelty-review score reduced by 25.")
        caveats.append("A known match may still be scientifically useful.")
    elif obs.known_object_match is None:
        caveats.append("Known-object cross-match has not been performed.")
    priority = "high" if score >= 70 else "review" if score >= 45 else "low"
    return CandidateResult(obs.candidate_id, score, priority, tuple(reasons), tuple(caveats))
