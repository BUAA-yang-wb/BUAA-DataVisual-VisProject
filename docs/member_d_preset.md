# 成员D预设分析设计包

> 用于成员B脚本在成员D正式产出前先行处理数据。后续如果成员D给出新口径，只需要调整脚本中的聚合输出或筛选规则。

## 分析问题清单

1. 招聘市场总体分布如何：哪些城市、行业、职位发布量最高？
2. 薪资待遇如何分化：薪资与城市、行业、职位、经验、学历之间有什么关系？
3. 高频职位画像是什么：某个职位集中在哪些城市和行业，对经验、学历、薪资有什么偏好？
4. 地域招聘画像是否相似：哪些城市在行业结构、经验结构、学历结构和薪资水平上接近？

## 页面与图表设计预设

| 页面 | 图表 | 数据粒度 | 主要指标 |
| --- | --- | --- | --- |
| 市场总览 | KPI、城市排名柱状图、行业排名柱状图 | 全局、城市、行业 | 招聘数、企业数、平均月薪、中位月薪 |
| 薪酬分析 | 薪资区间分布、行业薪资排名、城市薪资排名、经验薪资对比 | 薪资区间、行业、城市、经验 | 平均月薪、中位月薪、四分位薪资、年薪估算 |
| 职位画像 | 职位排名、职位对应城市/行业/经验/学历 TopN | 职位 | 招聘数、平均月薪、热门城市、热门行业 |
| 地域画像 | 城市-行业热力图、城市相似度列表 | 城市、行业 | 招聘数、平均月薪、相似度 |

## 前端数据需求表

| 文件 | 用途 |
| --- | --- |
| `data/processed/cleaned_jobs.csv` | 明细数据，可用于表格、筛选和回溯 |
| `data/processed/overview.json` | 总览 KPI 和整体薪资统计 |
| `data/processed/aggregates/city_stats.json` | 城市排名、城市薪资和城市画像 |
| `data/processed/aggregates/industry_stats.json` | 行业排名、行业薪资和行业画像 |
| `data/processed/aggregates/job_title_stats_top.json` | 高频职位画像 |
| `data/processed/aggregates/experience_stats.json` | 经验要求薪资对比 |
| `data/processed/aggregates/education_stats.json` | 学历要求薪资对比 |
| `data/processed/aggregates/salary_distribution.json` | 薪资区间分布 |
| `data/processed/aggregates/city_industry_heatmap.json` | 城市-行业热力图 |
| `data/processed/aggregates/city_similarity.json` | 地域招聘特征相似度 |
| `data/processed/insights.json` | 汇报用洞见候选 |

## 洞见判断口径

- 高薪岗位：`salary_avg_k >= 12`，即平均月薪不低于 12K。
- 城市招聘活跃度：按清洗后招聘记录数衡量。
- 行业/城市薪资水平：优先使用平均月薪，同时保留中位数和四分位数，避免单个极端值误导。
- 高频职位画像：默认只输出招聘数 Top 200 的职位，避免前端加载过大。
- 地域相似度：基于招聘规模、平均薪资、高薪占比、头部行业占比、经验占比、学历占比计算余弦相似度。

