#!/usr/bin/env python3
"""Member B data-processing pipeline for the JobWanted project.

This script intentionally uses only the Python standard library so the data
package can be reproduced on a fresh machine without installing pandas.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, median
from typing import Any


REQUIRED_FIELDS = [
    "job_title",
    "city",
    "salary",
    "experience",
    "education",
    "company",
    "company_type",
]

SALARY_BINS = [
    (0, 3, "0-3K"),
    (3, 5, "3-5K"),
    (5, 8, "5-8K"),
    (8, 12, "8-12K"),
    (12, 20, "12-20K"),
    (20, 30, "20-30K"),
    (30, float("inf"), "30K+"),
]

CITY_RE = re.compile(r"^[A-Z]\d{3}$")
SALARY_RANGE_RE = re.compile(
    r"^\s*(?P<low>\d+(?:\.\d+)?)\s*-\s*(?P<high>\d+(?:\.\d+)?)\s*"
    r"(?P<unit>[Kk]|千|万)?"
    r"(?:\s*[·xX*]\s*(?P<months>\d+)\s*薪)?\s*$"
)
SALARY_SINGLE_RE = re.compile(
    r"^\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>[Kk]|千|万)?"
    r"(?:\s*[·xX*]\s*(?P<months>\d+)\s*薪)?\s*$"
)


@dataclass
class GroupAgg:
    count: int = 0
    salary_avg_values: list[float] = field(default_factory=list)
    annual_salary_values: list[float] = field(default_factory=list)
    companies: Counter[str] = field(default_factory=Counter)
    job_titles: Counter[str] = field(default_factory=Counter)
    cities: Counter[str] = field(default_factory=Counter)
    industries: Counter[str] = field(default_factory=Counter)
    experiences: Counter[str] = field(default_factory=Counter)
    educations: Counter[str] = field(default_factory=Counter)

    def add(self, row: dict[str, Any]) -> None:
        self.count += 1
        self.salary_avg_values.append(float(row["salary_avg_k"]))
        self.annual_salary_values.append(float(row["salary_annual_k"]))
        self.companies[row["company"]] += 1
        self.job_titles[row["job_title"]] += 1
        self.cities[row["city"]] += 1
        self.industries[row["company_type"]] += 1
        self.experiences[row["experience"]] += 1
        self.educations[row["education"]] += 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build member B data package.")
    parser.add_argument("--input", default="data/JobWanted.csv", help="Raw JobWanted CSV.")
    parser.add_argument("--output-dir", default="data/processed", help="Output directory.")
    parser.add_argument(
        "--top-n",
        type=int,
        default=200,
        help="Maximum rows for large ranked aggregate outputs.",
    )
    parser.add_argument(
        "--min-group-count",
        type=int,
        default=100,
        help="Minimum sample size used by insight ranking.",
    )
    return parser.parse_args()


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def salary_unit_multiplier(unit: str | None) -> float:
    if not unit:
        return 1.0
    if unit in {"K", "k", "千"}:
        return 1.0
    if unit == "万":
        return 10.0
    return 1.0


def parse_salary(raw_salary: str) -> dict[str, Any] | None:
    """Parse monthly salary text into K RMB metrics.

    Supported examples include 5-10K, 5-10K·13薪 and single-value fallbacks.
    Unknown or nonsensical salaries return None and are dropped from cleaned data.
    """

    salary = clean_text(raw_salary).replace(" ", "")
    if not salary or salary.lower() in {"nan", "none", "null", "-", "--"}:
        return None

    match = SALARY_RANGE_RE.match(salary)
    if match:
        low = float(match.group("low"))
        high = float(match.group("high"))
        multiplier = salary_unit_multiplier(match.group("unit"))
        months = int(match.group("months") or 12)
        low *= multiplier
        high *= multiplier
    else:
        match = SALARY_SINGLE_RE.match(salary)
        if not match:
            return None
        value = float(match.group("value")) * salary_unit_multiplier(match.group("unit"))
        low = value
        high = value
        months = int(match.group("months") or 12)

    if low <= 0 or high <= 0 or high < low or high > 500 or months < 1 or months > 30:
        return None

    avg_k = (low + high) / 2
    return {
        "salary_min_k": round(low, 2),
        "salary_max_k": round(high, 2),
        "salary_avg_k": round(avg_k, 2),
        "salary_months": months,
        "salary_annual_k": round(avg_k * months, 2),
    }


def salary_level(avg_k: float) -> str:
    if avg_k < 5:
        return "low"
    if avg_k < 12:
        return "medium"
    if avg_k < 25:
        return "high"
    return "very_high"


def salary_bin(avg_k: float) -> str:
    for low, high, label in SALARY_BINS:
        if low <= avg_k < high:
            return label
    return "unknown"


def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    pos = (len(sorted_values) - 1) * q
    lower = math.floor(pos)
    upper = math.ceil(pos)
    if lower == upper:
        return round(sorted_values[int(pos)], 2)
    weight = pos - lower
    return round(sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight, 2)


def numeric_summary(values: list[float]) -> dict[str, Any]:
    if not values:
        return {
            "avg": None,
            "median": None,
            "q1": None,
            "q3": None,
            "min": None,
            "max": None,
        }
    return {
        "avg": round(mean(values), 2),
        "median": round(median(values), 2),
        "q1": quantile(values, 0.25),
        "q3": quantile(values, 0.75),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
    }


def top_items(counter: Counter[str], n: int = 5) -> list[dict[str, Any]]:
    return [{"name": key, "count": count} for key, count in counter.most_common(n)]


def group_to_record(name: str, agg: GroupAgg) -> dict[str, Any]:
    return {
        "name": name,
        "count": agg.count,
        "avg_salary_k": numeric_summary(agg.salary_avg_values)["avg"],
        "median_salary_k": numeric_summary(agg.salary_avg_values)["median"],
        "salary_q1_k": numeric_summary(agg.salary_avg_values)["q1"],
        "salary_q3_k": numeric_summary(agg.salary_avg_values)["q3"],
        "avg_annual_salary_k": numeric_summary(agg.annual_salary_values)["avg"],
        "company_count": len(agg.companies),
        "job_title_count": len(agg.job_titles),
        "top_companies": top_items(agg.companies, 5),
        "top_job_titles": top_items(agg.job_titles, 5),
        "top_cities": top_items(agg.cities, 5),
        "top_industries": top_items(agg.industries, 5),
        "top_experience": top_items(agg.experiences, 5),
        "top_education": top_items(agg.educations, 5),
    }


def aggregate_by(rows: list[dict[str, Any]], key: str, top_n: int | None = None) -> list[dict[str, Any]]:
    grouped: dict[str, GroupAgg] = defaultdict(GroupAgg)
    for row in rows:
        grouped[row[key]].add(row)
    records = [group_to_record(name, agg) for name, agg in grouped.items()]
    records.sort(key=lambda item: (-item["count"], str(item["name"])))
    return records[:top_n] if top_n else records


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def write_markdown(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_and_clean(input_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    cleaned_rows: list[dict[str, Any]] = []
    missing_counts = Counter()
    dropped_reasons = Counter()
    raw_field_counts = {field_name: Counter() for field_name in REQUIRED_FIELDS if field_name != "salary"}
    seen_original_rows: set[tuple[str, ...]] = set()
    duplicate_rows = 0
    raw_rows = 0

    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row_index, raw_row in enumerate(reader, start=1):
            raw_rows += 1
            row = {field_name: clean_text(raw_row.get(field_name, "")) for field_name in REQUIRED_FIELDS}

            for field_name, value in row.items():
                if not value:
                    missing_counts[field_name] += 1

            original_key = tuple(row[field_name] for field_name in REQUIRED_FIELDS)
            if original_key in seen_original_rows:
                duplicate_rows += 1
                dropped_reasons["duplicate_row"] += 1
                continue
            seen_original_rows.add(original_key)

            if any(not row[field_name] for field_name in REQUIRED_FIELDS):
                dropped_reasons["missing_required_field"] += 1
                continue
            if not CITY_RE.match(row["city"]):
                dropped_reasons["invalid_city_code"] += 1
                continue

            salary_metrics = parse_salary(row["salary"])
            if salary_metrics is None:
                dropped_reasons["invalid_salary"] += 1
                continue

            for field_name in raw_field_counts:
                raw_field_counts[field_name][row[field_name]] += 1

            cleaned = {
                "row_id": row_index,
                **row,
                **salary_metrics,
                "salary_level": salary_level(float(salary_metrics["salary_avg_k"])),
                "salary_bin": salary_bin(float(salary_metrics["salary_avg_k"])),
            }
            cleaned_rows.append(cleaned)

    quality = {
        "raw_rows": raw_rows,
        "cleaned_rows": len(cleaned_rows),
        "dropped_rows": raw_rows - len(cleaned_rows),
        "duplicate_rows": duplicate_rows,
        "missing_counts": dict(missing_counts),
        "dropped_reasons": dict(dropped_reasons),
        "unique_counts_after_cleaning": {
            field_name: len(counter) for field_name, counter in raw_field_counts.items()
        },
    }
    return cleaned_rows, quality


def write_cleaned_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "row_id",
        "job_title",
        "city",
        "salary",
        "salary_min_k",
        "salary_max_k",
        "salary_avg_k",
        "salary_months",
        "salary_annual_k",
        "salary_level",
        "salary_bin",
        "experience",
        "education",
        "company",
        "company_type",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_overview(rows: list[dict[str, Any]], quality: dict[str, Any]) -> dict[str, Any]:
    salaries = [float(row["salary_avg_k"]) for row in rows]
    annual_salaries = [float(row["salary_annual_k"]) for row in rows]
    return {
        "dataset": "JobWanted",
        "raw_rows": quality["raw_rows"],
        "cleaned_rows": quality["cleaned_rows"],
        "retention_rate": round(quality["cleaned_rows"] / quality["raw_rows"], 4)
        if quality["raw_rows"]
        else 0,
        "unique_counts": quality["unique_counts_after_cleaning"],
        "monthly_salary_k": numeric_summary(salaries),
        "annual_salary_k": numeric_summary(annual_salaries),
        "salary_level_distribution": Counter(row["salary_level"] for row in rows),
        "salary_bin_distribution": Counter(row["salary_bin"] for row in rows),
    }


def build_salary_distribution(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, GroupAgg] = defaultdict(GroupAgg)
    for row in rows:
        grouped[row["salary_bin"]].add(row)
    order = {label: idx for idx, (_, _, label) in enumerate(SALARY_BINS)}
    records = [group_to_record(name, agg) for name, agg in grouped.items()]
    records.sort(key=lambda item: order.get(item["name"], 999))
    return records


def build_heatmap(rows: list[dict[str, Any]], top_cities: int = 30, top_industries: int = 20) -> list[dict[str, Any]]:
    city_counter = Counter(row["city"] for row in rows)
    industry_counter = Counter(row["company_type"] for row in rows)
    selected_cities = {name for name, _ in city_counter.most_common(top_cities)}
    selected_industries = {name for name, _ in industry_counter.most_common(top_industries)}
    matrix: dict[tuple[str, str], GroupAgg] = defaultdict(GroupAgg)
    for row in rows:
        if row["city"] in selected_cities and row["company_type"] in selected_industries:
            matrix[(row["city"], row["company_type"])].add(row)
    records = []
    for (city, industry), agg in matrix.items():
        salary_stats = numeric_summary(agg.salary_avg_values)
        records.append(
            {
                "city": city,
                "company_type": industry,
                "count": agg.count,
                "avg_salary_k": salary_stats["avg"],
                "median_salary_k": salary_stats["median"],
            }
        )
    records.sort(key=lambda item: (item["city"], item["company_type"]))
    return records


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def build_city_similarity(rows: list[dict[str, Any]], top_city_n: int = 80) -> list[dict[str, Any]]:
    city_counter = Counter(row["city"] for row in rows)
    top_cities = [name for name, _ in city_counter.most_common(top_city_n)]
    top_industries = [name for name, _ in Counter(row["company_type"] for row in rows).most_common(12)]
    top_experiences = [name for name, _ in Counter(row["experience"] for row in rows).most_common(5)]
    top_educations = [name for name, _ in Counter(row["education"] for row in rows).most_common(5)]

    city_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["city"] in top_cities:
            city_rows[row["city"]].append(row)

    global_max_count = max((len(items) for items in city_rows.values()), default=1)
    vectors: dict[str, list[float]] = {}
    for city, items in city_rows.items():
        count = len(items)
        avg_salary = mean(float(row["salary_avg_k"]) for row in items)
        high_salary_rate = sum(float(row["salary_avg_k"]) >= 12 for row in items) / count
        industry_counts = Counter(row["company_type"] for row in items)
        experience_counts = Counter(row["experience"] for row in items)
        education_counts = Counter(row["education"] for row in items)
        vector = [
            count / global_max_count,
            avg_salary / 50,
            high_salary_rate,
        ]
        vector.extend(industry_counts[item] / count for item in top_industries)
        vector.extend(experience_counts[item] / count for item in top_experiences)
        vector.extend(education_counts[item] / count for item in top_educations)
        vectors[city] = vector

    records = []
    for city, vector in vectors.items():
        candidates = []
        for other_city, other_vector in vectors.items():
            if other_city == city:
                continue
            candidates.append(
                {
                    "city": other_city,
                    "similarity": round(cosine_similarity(vector, other_vector), 4),
                }
            )
        candidates.sort(key=lambda item: (-item["similarity"], item["city"]))
        records.append(
            {
                "city": city,
                "count": len(city_rows[city]),
                "top_similar_cities": candidates[:5],
            }
        )
    records.sort(key=lambda item: (-item["count"], item["city"]))
    return records


def make_insights(
    rows: list[dict[str, Any]],
    city_stats: list[dict[str, Any]],
    industry_stats: list[dict[str, Any]],
    job_stats: list[dict[str, Any]],
    experience_stats: list[dict[str, Any]],
    min_group_count: int,
) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []
    cleaned_count = len(rows)
    high_salary_count = sum(float(row["salary_avg_k"]) >= 12 for row in rows)

    top_city = city_stats[0]
    insights.append(
        {
            "title": "招聘活跃度头部城市集中",
            "finding": f"{top_city['name']} 的招聘记录数最多，占清洗后数据的 {top_city['count'] / cleaned_count:.1%}。",
            "evidence": {
                "city": top_city["name"],
                "count": top_city["count"],
                "share": round(top_city["count"] / cleaned_count, 4),
                "avg_salary_k": top_city["avg_salary_k"],
            },
            "use_for_visual": "市场总览中的城市排名柱状图和地域画像入口。",
        }
    )

    qualified_industries = [item for item in industry_stats if item["count"] >= min_group_count]
    salary_leader = max(qualified_industries, key=lambda item: item["avg_salary_k"])
    insights.append(
        {
            "title": "高薪行业可以按均薪识别",
            "finding": f"{salary_leader['name']} 在样本数不低于 {min_group_count} 的行业中平均月薪最高。",
            "evidence": {
                "company_type": salary_leader["name"],
                "count": salary_leader["count"],
                "avg_salary_k": salary_leader["avg_salary_k"],
                "median_salary_k": salary_leader["median_salary_k"],
            },
            "use_for_visual": "薪酬分析中的行业薪资排名与箱线/区间图。",
        }
    )

    qualified_cities = [item for item in city_stats if item["count"] >= min_group_count]
    high_salary_city = max(qualified_cities, key=lambda item: item["avg_salary_k"])
    insights.append(
        {
            "title": "城市之间存在可展示的薪资差异",
            "finding": f"{high_salary_city['name']} 在样本数不低于 {min_group_count} 的城市中平均月薪最高。",
            "evidence": {
                "city": high_salary_city["name"],
                "count": high_salary_city["count"],
                "avg_salary_k": high_salary_city["avg_salary_k"],
                "median_salary_k": high_salary_city["median_salary_k"],
            },
            "use_for_visual": "地域画像中的薪资地图/散点图。",
        }
    )

    top_job = job_stats[0]
    insights.append(
        {
            "title": "职位画像可从高频职位切入",
            "finding": f"{top_job['name']} 是出现次数最多的职位代码，可作为职位画像页面的默认示例。",
            "evidence": {
                "job_title": top_job["name"],
                "count": top_job["count"],
                "avg_salary_k": top_job["avg_salary_k"],
                "top_cities": top_job["top_cities"],
                "top_industries": top_job["top_industries"],
            },
            "use_for_visual": "职位画像中的城市偏好、行业偏好、经验和学历雷达图。",
        }
    )

    exp_leader = max(experience_stats, key=lambda item: item["avg_salary_k"])
    insights.append(
        {
            "title": "经验要求和薪资水平存在正向分析空间",
            "finding": f"{exp_leader['name']} 是当前经验代码中平均月薪最高的一类。",
            "evidence": {
                "experience": exp_leader["name"],
                "count": exp_leader["count"],
                "avg_salary_k": exp_leader["avg_salary_k"],
                "median_salary_k": exp_leader["median_salary_k"],
                "high_salary_record_count": high_salary_count,
            },
            "use_for_visual": "薪酬分析中的经验要求分组柱状图。",
        }
    )

    return insights


def markdown_table(rows: list[list[Any]]) -> str:
    return "\n".join("| " + " | ".join(str(cell) for cell in row) + " |" for row in rows)


def build_quality_report(quality: dict[str, Any], overview: dict[str, Any]) -> str:
    missing_rows = [["字段", "缺失数"]]
    missing_rows.append(["---", "---"])
    for field_name in REQUIRED_FIELDS:
        missing_rows.append([field_name, quality["missing_counts"].get(field_name, 0)])

    reason_rows = [["剔除原因", "记录数"], ["---", "---"]]
    for reason, count in quality["dropped_reasons"].items():
        reason_rows.append([reason, count])

    unique_rows = [["字段", "清洗后唯一值数量"], ["---", "---"]]
    for field_name, count in quality["unique_counts_after_cleaning"].items():
        unique_rows.append([field_name, count])

    return f"""# 成员B数据质量处理说明

## 清洗概况

- 原始记录数：{quality['raw_rows']}
- 清洗后记录数：{quality['cleaned_rows']}
- 剔除记录数：{quality['dropped_rows']}
- 保留率：{overview['retention_rate']:.2%}
- 精确重复记录数：{quality['duplicate_rows']}

## 缺失值检查

{markdown_table(missing_rows)}

## 剔除规则统计

{markdown_table(reason_rows)}

## 唯一值规模

{markdown_table(unique_rows)}

## 薪资解析口径

- `salary_min_k` / `salary_max_k`：从 `5-10K` 等薪资区间解析得到，单位为千元/月。
- `salary_avg_k`：月薪区间中点，作为主要薪资指标。
- `salary_months`：若存在 `·13薪` 等标记则使用对应月数，否则按 12 个月估算。
- `salary_annual_k`：`salary_avg_k * salary_months`，单位为千元/年。
- `salary_level`：按月均薪分为 `low`、`medium`、`high`、`very_high`。

## 说明

字段中的城市、职位、经验、学历和行业均为题目提供的匿名代码，脚本不做语义翻译，只保证编码一致、口径稳定、可被前端直接筛选和聚合。
"""


def build_field_dictionary() -> str:
    rows = [
        ["字段", "含义", "口径/用途"],
        ["---", "---", "---"],
        ["row_id", "原始行号", "便于回溯原始CSV中的记录位置"],
        ["job_title", "职位代码", "匿名职位标识，可用于职位画像和职位排名"],
        ["city", "城市/行政区划代码", "匿名地域标识，可用于地图、排名和相似度计算"],
        ["salary", "原始薪资文本", "保留原始字符串，便于核查解析结果"],
        ["salary_min_k", "最低月薪", "单位为千元/月"],
        ["salary_max_k", "最高月薪", "单位为千元/月"],
        ["salary_avg_k", "平均月薪", "区间中点，主要薪资指标"],
        ["salary_months", "估算发薪月数", "缺省为12，识别到13薪/15薪等则使用原始月数"],
        ["salary_annual_k", "估算年薪", "单位为千元/年"],
        ["salary_level", "薪资等级", "low/medium/high/very_high"],
        ["salary_bin", "薪资区间", "前端薪资分布图使用"],
        ["experience", "经验要求代码", "匿名经验标识"],
        ["education", "学历要求代码", "匿名学历标识"],
        ["company", "企业代码", "匿名企业标识"],
        ["company_type", "行业类别代码", "匿名行业标识"],
    ]
    return "# 成员B数据字段说明\n\n" + markdown_table(rows) + "\n"


def write_outputs(rows: list[dict[str, Any]], quality: dict[str, Any], output_dir: Path, top_n: int, min_group_count: int) -> None:
    aggregate_dir = output_dir / "aggregates"

    write_cleaned_csv(output_dir / "cleaned_jobs.csv", rows)

    overview = build_overview(rows, quality)
    city_stats = aggregate_by(rows, "city")
    industry_stats = aggregate_by(rows, "company_type")
    job_stats = aggregate_by(rows, "job_title", top_n=top_n)
    experience_stats = aggregate_by(rows, "experience")
    education_stats = aggregate_by(rows, "education")

    write_json(output_dir / "overview.json", overview)
    write_json(output_dir / "quality_report.json", quality)
    write_json(aggregate_dir / "city_stats.json", city_stats)
    write_json(aggregate_dir / "industry_stats.json", industry_stats)
    write_json(aggregate_dir / "job_title_stats_top.json", job_stats)
    write_json(aggregate_dir / "experience_stats.json", experience_stats)
    write_json(aggregate_dir / "education_stats.json", education_stats)
    write_json(aggregate_dir / "salary_distribution.json", build_salary_distribution(rows))
    write_json(aggregate_dir / "city_industry_heatmap.json", build_heatmap(rows))
    write_json(aggregate_dir / "city_similarity.json", build_city_similarity(rows))
    write_json(
        output_dir / "insights.json",
        make_insights(rows, city_stats, industry_stats, job_stats, experience_stats, min_group_count),
    )

    write_markdown(output_dir / "data_quality_report.md", build_quality_report(quality, overview))
    write_markdown(output_dir / "field_dictionary.md", build_field_dictionary())


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    rows, quality = read_and_clean(input_path)
    if not rows:
        raise RuntimeError("No valid records were produced after cleaning.")
    write_outputs(rows, quality, output_dir, args.top_n, args.min_group_count)

    print(f"Member B data package written to {output_dir}")
    print(f"Raw rows: {quality['raw_rows']}")
    print(f"Cleaned rows: {quality['cleaned_rows']}")
    print(f"Dropped rows: {quality['dropped_rows']}")


if __name__ == "__main__":
    main()
