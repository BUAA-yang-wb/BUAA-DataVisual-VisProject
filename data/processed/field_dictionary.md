# 成员B数据字段说明

| 字段 | 含义 | 口径/用途 |
| --- | --- | --- |
| row_id | 原始行号 | 便于回溯原始CSV中的记录位置 |
| job_title | 职位代码 | 匿名职位标识，可用于职位画像和职位排名 |
| city | 城市/行政区划代码 | 匿名地域标识，可用于地图、排名和相似度计算 |
| salary | 原始薪资文本 | 保留原始字符串，便于核查解析结果 |
| salary_min_k | 最低月薪 | 单位为千元/月 |
| salary_max_k | 最高月薪 | 单位为千元/月 |
| salary_avg_k | 平均月薪 | 区间中点，主要薪资指标 |
| salary_months | 估算发薪月数 | 缺省为12，识别到13薪/15薪等则使用原始月数 |
| salary_annual_k | 估算年薪 | 单位为千元/年 |
| salary_level | 薪资等级 | low/medium/high/very_high |
| salary_bin | 薪资区间 | 前端薪资分布图使用 |
| experience | 经验要求代码 | 匿名经验标识 |
| education | 学历要求代码 | 匿名学历标识 |
| company | 企业代码 | 匿名企业标识 |
| company_type | 行业类别代码 | 匿名行业标识 |
