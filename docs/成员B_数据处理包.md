# 《职数洞见》成员B数据处理包

本文档根据成员D的分析设计包和项目分工整理，用于交付给成员C进行系统实现，并供成员A后续汇报时引用数据处理口径和洞见证据。

## 1. 成员B任务目标

成员B负责把原始招聘数据处理成可分析、可展示、可直接接入前端的结构化数据包。核心目标包括：

1. 完成数据质量检查、清洗和薪资解析。
2. 按成员D设计的四个页面输出前端可用聚合数据。
3. 计算招聘活跃度、薪资差异、职位画像、城市相似度等指标。
4. 输出 3-5 条带证据的数据洞见候选。
5. 形成可复现脚本和交接说明，避免成员C重复处理数据。

## 2. 输入文件

| 文件 | 用途 |
| --- | --- |
| `data/JobWanted.csv` | 原始招聘数据 |
| `docs/成员D_分析设计包.md` | 分析问题、页面设计、前端数据需求和洞见口径 |
| `docs/项目分工.md` | 成员B职责、技术栈和交付边界 |

## 3. 数据处理脚本

脚本位置：

- `scripts/process_member_b.py`

运行方式：

```bash
python scripts/process_member_b.py
```

脚本默认读取 `data/JobWanted.csv`，输出到 `data/processed/`。可选参数：

```bash
python scripts/process_member_b.py --input data/JobWanted.csv --output-dir data/processed --top-n 200 --min-group-count 100
```

## 4. 清洗与指标口径

| 处理项 | 口径 |
| --- | --- |
| 必要字段 | `job_title`、`city`、`salary`、`experience`、`education`、`company`、`company_type` |
| 重复处理 | 完全重复记录只保留一条 |
| 城市合法性 | 保留形如 `A123` 的匿名行政区划代码 |
| 薪资解析 | 支持 `5-10K`、`5-10K·13薪`、单值薪资等格式 |
| 月薪指标 | `salary_avg_k = (salary_min_k + salary_max_k) / 2`，单位 K/月 |
| 年薪估算 | `salary_annual_k = salary_avg_k * salary_months`，默认 12 薪 |
| 薪资分箱 | `0-3K`、`3-5K`、`5-8K`、`8-12K`、`12-20K`、`20-30K`、`30K+` |
| 箱线图阈值 | 默认只输出样本量不少于 50 的城市/行业 |
| 洞见阈值 | 默认用样本量不少于 100 的分组筛选候选 |

## 5. 输出文件清单

基础文件：

| 文件 | 说明 |
| --- | --- |
| `data/processed/cleaned_jobs.csv` | 清洗后的逐条招聘记录 |
| `data/processed/overview.json` | 全局 KPI、薪资统计、唯一值规模 |
| `data/processed/quality_report.json` | 缺失、重复、剔除原因等质量统计 |
| `data/processed/data_quality_report.md` | 数据质量处理说明 |
| `data/processed/field_dictionary.md` | 清洗后字段字典 |
| `data/processed/insights.json` | 数据洞见候选及证据 |

基础聚合文件：

| 文件 | 对应用途 |
| --- | --- |
| `aggregates/city_stats.json` | 城市 Top、地图点位、城市散点 |
| `aggregates/industry_stats.json` | 行业 Top、行业薪资对比 |
| `aggregates/job_title_stats_top.json` | Top 职位、职位薪资排名 |
| `aggregates/salary_distribution.json` | 薪酬分布直方图 |
| `aggregates/experience_distribution.json` | 经验占比 |
| `aggregates/education_distribution.json` | 学历占比 |
| `aggregates/salary_boxplot_city.json` | 城市薪资箱线图 |
| `aggregates/salary_boxplot_industry.json` | 行业薪资箱线图 |
| `aggregates/city_industry_heatmap.json` | 城市 x 行业薪资热力图 |
| `aggregates/salary_scatter_city.json` | 城市岗位数-薪资散点 |
| `aggregates/salary_scatter_industry.json` | 行业岗位数-薪资散点 |
| `aggregates/salary_by_experience.json` | 经验与薪资分组 |
| `aggregates/salary_by_education.json` | 学历与薪资分组 |
| `aggregates/job_requirement_distribution.json` | 职位经验/学历要求分布 |
| `aggregates/job_profile_cards.json` | 职位画像卡片数据 |
| `aggregates/city_radar.json` | 城市雷达图指标 |
| `aggregates/city_similarity.json` | 相似城市、聚类编号和二维坐标 |

页面级数据包：

| 文件 | 对应成员D页面 |
| --- | --- |
| `views/overview_page.json` | 页面A：市场总览 |
| `views/salary_patterns_page.json` | 页面B：薪酬模式分析 |
| `views/job_profile_page.json` | 页面C：职位画像 |
| `views/region_portrait_page.json` | 页面D：地域画像 |

## 6. 与成员D数据需求表的对应关系

| 成员D视图 | 成员B输出 |
| --- | --- |
| A-1 KPI | `overview.json`、`views/overview_page.json.kpi` |
| A-2 城市Top | `aggregates/city_stats.json`、`views/overview_page.json.top_cities` |
| A-3 行业Top | `aggregates/industry_stats.json`、`views/overview_page.json.top_industries` |
| A-4 薪酬分布 | `aggregates/salary_distribution.json` |
| A-5 经验/学历占比 | `aggregates/experience_distribution.json`、`aggregates/education_distribution.json` |
| B-1 薪资箱线 | `aggregates/salary_boxplot_city.json`、`aggregates/salary_boxplot_industry.json` |
| B-2 城市x行业热力 | `aggregates/city_industry_heatmap.json` |
| B-3 薪资散点 | `aggregates/salary_scatter_city.json`、`aggregates/salary_scatter_industry.json` |
| B-4 经验/学历薪资 | `aggregates/salary_by_experience.json`、`aggregates/salary_by_education.json` |
| C-1 职位Top | `aggregates/job_title_stats_top.json` |
| C-2 职位要求分布 | `aggregates/job_requirement_distribution.json` |
| C-3 职位画像卡片 | `aggregates/job_profile_cards.json` |
| D-1 地图 | `aggregates/city_stats.json` |
| D-2 城市雷达 | `aggregates/city_radar.json` |
| D-3 相似城市 | `aggregates/city_similarity.json` |

## 7. 本次处理结果摘要

- 原始记录数：430,664
- 清洗后记录数：421,160
- 剔除记录数：9,504
- 数据保留率：97.79%
- 覆盖城市代码数：371
- 覆盖行业类别数：158
- 平均月薪：9.58K
- 中位月薪：7.50K

## 8. 交付说明

成员C优先读取 `data/processed/views/` 下的四个页面级 JSON 文件实现前端页面；如需要更灵活的图表组合，再读取 `data/processed/aggregates/` 下的基础聚合文件。

成员A可直接使用 `data/processed/data_quality_report.md`、`data/processed/field_dictionary.md` 和 `data/processed/insights.json` 制作数据处理与洞见展示页。
