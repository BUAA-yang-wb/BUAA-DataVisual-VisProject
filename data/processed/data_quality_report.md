# 成员B数据质量处理说明

## 清洗概况

- 原始记录数：430664
- 清洗后记录数：421160
- 剔除记录数：9504
- 保留率：97.79%
- 精确重复记录数：53

## 缺失值检查

| 字段 | 缺失数 |
| --- | --- |
| job_title | 0 |
| city | 0 |
| salary | 0 |
| experience | 0 |
| education | 0 |
| company | 0 |
| company_type | 0 |

## 剔除规则统计

| 剔除原因 | 记录数 |
| --- | --- |
| invalid_salary | 9451 |
| duplicate_row | 53 |

## 唯一值规模

| 字段 | 清洗后唯一值数量 |
| --- | --- |
| job_title | 165235 |
| city | 371 |
| experience | 8 |
| education | 8 |
| company | 263268 |
| company_type | 158 |

## 薪资解析口径

- `salary_min_k` / `salary_max_k`：从 `5-10K` 等薪资区间解析得到，单位为千元/月。
- `salary_avg_k`：月薪区间中点，作为主要薪资指标。
- `salary_months`：若存在 `·13薪` 等标记则使用对应月数，否则按 12 个月估算。
- `salary_annual_k`：`salary_avg_k * salary_months`，单位为千元/年。
- `salary_level`：按月均薪分为 `low`、`medium`、`high`、`very_high`。

## 说明

字段中的城市、职位、经验、学历和行业均为题目提供的匿名代码，脚本不做语义翻译，只保证编码一致、口径稳定、可被前端直接筛选和聚合。
