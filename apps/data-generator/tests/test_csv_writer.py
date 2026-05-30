import csv
from pathlib import Path

from generator.cli import build_dataset
from generator.config import GeneratorConfig
from generator.domain import MlTrainingRow
from generator.writers.csv_writer import _FIELDNAMES, _ml_training_rows, write_ml_training_csv


def test_csv_writer_builds_valid_ml_training_rows_before_serializing(tmp_path: Path) -> None:
    config = GeneratorConfig(seed=42, days=1, output_dir=tmp_path)
    dataset = build_dataset(config)

    training_rows = _ml_training_rows(dataset)
    output_path = write_ml_training_csv(dataset, tmp_path)

    assert training_rows
    assert len(training_rows) == len(dataset.assignments)
    assert all(isinstance(row, MlTrainingRow) for row in training_rows)

    with output_path.open(encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        rows = list(reader)

    assert tuple(reader.fieldnames or ()) == _FIELDNAMES
    assert len(rows) == len(training_rows)
