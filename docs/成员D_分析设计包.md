# 《职数洞见》成员D分析设计包

本文档用于交付给成员B和成员C，保证后续数据处理与系统实现有明确方向与一致口径。

## 1. 主分析问题清单（4个）

1. 招聘市场总体结构如何？哪些城市与行业最活跃，岗位需求分布如何？
2. 薪酬模式与差异在哪里？薪酬与城市、行业、经验、学历之间的关系是什么？
3. 职位画像如何？不同职位的经验/学历门槛与薪酬水平是否存在明显分层？
4. 地域招聘画像如何？哪些城市招聘特征相似，哪些城市“高薪但岗位少”或“岗位多但薪资一般”？

## 2. 页面与图表设计说明

### 页面A：市场总览（Overview）
目标：快速理解市场规模与结构。

- KPI 卡片：总岗位数、覆盖城市数、覆盖行业数、平均月薪（清洗后）。
- Top 城市柱状图：x=城市，y=岗位数；可切换为平均月薪。
- Top 行业柱状图：x=行业，y=岗位数；可切换为平均月薪。
- 薪酬分布图：直方图（avg_month_salary_k 分箱）。
- 经验/学历占比：双环或并列饼图（experience、education）。

交互建议：
- 城市/行业 Top 列表可点击高亮并联动页面B、C。
- 指标切换：岗位数/平均月薪/中位月薪。

### 页面B：薪酬模式分析（Salary Patterns）
目标：呈现薪酬差异与影响因素。

- 箱线图：按行业（或城市）展示薪资分布（avg_month_salary_k）。
- 热力图：城市 x 行业，颜色=平均月薪，大小或边框=岗位数。
- 散点图：x=岗位数，y=平均月薪，点=城市或行业（可切换）。
- 经验/学历与薪酬：分组柱状图（经验/学历 -> 平均月薪）。

交互建议：
- 维度切换：城市/行业/经验/学历。
- 过滤：最低岗位数阈值（例如>=50）。

### 页面C：职位画像（Job Profile）
目标：聚焦“职位类型”与要求层次。

- Top 职位柱状图：x=职位，y=岗位数（Top 20）。
- 职位 vs 薪酬：x=职位，y=平均月薪（可排序）。
- 职位要求堆叠柱：按职位分组，堆叠经验或学历分布。
- 职位画像卡片：点击职位展示该职位的城市Top、行业Top、薪酬区间。

交互建议：
- 职位点击联动城市/行业Top列表。
- 排序切换：岗位数/平均月薪/中位月薪。

### 页面D：地域画像（Region Portrait）
目标：展示地域招聘活跃度与相似城市群。

- 地图：城市点位或热力，颜色=平均月薪，大小=岗位数。
- 城市画像雷达图：展示招聘活跃度、平均薪资、行业多样性、经验门槛。
- 相似城市聚类散点：基于城市特征向量降维（PCA/TSNE），颜色=聚类。

交互建议：
- 城市选择联动雷达图与相似城市列表。
- 聚类数可选（默认 5 或 6）。

## 3. 前端数据需求表

说明：所有薪酬均使用清洗后的数值字段（单位 K/月）。

| 视图 | 需要的字段 | 聚合粒度 | 指标口径 | 主要输出字段 | 备注/筛选 |
| --- | --- | --- | --- | --- | --- |
| A-1 KPI | 原始清洗后全表 | 全局 | 去除无效薪资与空城市/行业 | job_count, city_count, industry_count, avg_salary | 只统计有效记录 |
| A-2 城市Top | city | city | job_count, avg_salary, median_salary | city, job_count, avg_salary, median_salary | Top N=20 |
| A-3 行业Top | company_type | industry | job_count, avg_salary, median_salary | industry, job_count, avg_salary, median_salary | Top N=20 |
| A-4 薪酬分布 | avg_month_salary_k | bin | 直方图频数 | bin, count | bin_size=1K 或 2K |
| A-5 经验/学历占比 | experience / education | category | job_count, ratio | category, count, ratio | 类别过多可合并“其他” |
| B-1 薪资箱线 | city/industry | group | salary_min, q1, median, q3, max | group, min, q1, median, q3, max | group>=50 |
| B-2 城市x行业热力 | city+industry | cross | avg_salary, job_count | city, industry, avg_salary, job_count | 仅Top城市与Top行业 |
| B-3 薪资散点 | city/industry | group | avg_salary, job_count | group, avg_salary, job_count | 气泡大小=job_count |
| B-4 经验/学历薪资 | experience/education | group | avg_salary, median_salary | group, avg_salary, median_salary | 统一排序 |
| C-1 职位Top | job_title | job_title | job_count, avg_salary | job_title, job_count, avg_salary | Top N=20 |
| C-2 职位要求分布 | job_title + experience/education | job_title + category | count, ratio | job_title, category, count, ratio | 仅Top职位 |
| C-3 职位画像卡片 | job_title + city/industry | job_title + category | count, avg_salary | job_title, category, count, avg_salary | 点击联动 |
| D-1 地图 | city | city | job_count, avg_salary | city, job_count, avg_salary | 需城市坐标（可后补） |
| D-2 城市雷达 | city | city | activity_index, avg_salary, industry_diversity, exp_level | city, metric_name, value | 归一化到[0,1] |
| D-3 相似城市 | city | city | city_vector, cluster_id, x, y | city, cluster_id, x, y | PCA/TSNE 输出二维坐标 |

## 4. 洞见判断口径说明

### 4.1 高薪职位定义
- 年薪估算：$annual\_salary = avg\_month\_salary\_k \times months$。
- 高薪职位：$annual\_salary$ 位于前 15% 且岗位数 $>= 50$。

### 4.2 城市招聘活跃度
- 活跃度指标：$activity = job\_count / total\_job\_count$。
- 高活跃城市：activity 前 10% 或 job_count 前 15%。

### 4.3 行业多样性
- 使用信息熵：$H = -\sum p_i \log(p_i)$，$p_i$ 为城市内行业占比。
- 多样性高：$H$ 位于前 25%。

### 4.4 薪酬模式差异
- 对比经验/学历维度的平均薪资差异。
- 若同一行业内，不同经验组平均薪资差值 $>= 3K$ 且样本量 $>= 50$，视为显著差异。

### 4.5 相似城市判定
- 城市向量特征：
  - job_count（归一化）
  - avg_salary
  - industry_diversity
  - 经验要求占比（应届、1-3年、3-5年等）
  - 行业Top1占比
- 计算方式：特征标准化后使用余弦相似度或欧式距离。
- 相似城市：距离位于前 5%（或同一聚类簇）。

## 5. 交付给下一棒的说明

- 成员B：请严格按照本文件第3节的数据需求表进行清洗与聚合输出，并按第4节口径产出 3-5 条洞见候选及证据。
- 成员C：请优先实现第2节四个页面，确保联动与筛选功能可用，图表类型如需调整请保持指标口径一致。
