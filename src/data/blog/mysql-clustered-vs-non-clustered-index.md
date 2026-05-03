---
author: stackbug
pubDatetime: 2021-03-09T00:00:00+08:00
title: MySQL 聚簇索引和非聚簇索引
slug: mysql-clustered-vs-non-clustered-index
featured: false
draft: false
tags:
  - mysql
  - database
  - backend
description: MySQL InnoDB 聚簇索引与非聚簇索引的区别、回表机制与索引设计要点。
---

MySQL 聚簇索引和非聚簇索引

## 示例表

```sql
CREATE TABLE student (
    id    INT PRIMARY KEY AUTO_INCREMENT,
    name  VARCHAR(50),
    age   INT,
    score DECIMAL(5,2),
    INDEX idx_name (name),
    INDEX idx_name_age (name, age)
) ENGINE=InnoDB;

```

| id | name | age | score |
| --- | --- | --- | --- |
| 1 | 张三 | 20 | 88.5 |
| 2 | 李四 | 21 | 92.0 |
| 3 | 王五 | 19 | 76.5 |
| 4 | 赵六 | 22 | 95.0 |
| 5 | 张三 | 23 | 81.0 |

---

## 1. 聚簇索引（主键 id）

叶子节点直接存 整行数据，数据按主键物理排序，每表只有 1 个。

```mermaid
graph TD
Root["非叶子节点 [3]"]
Root --> LeafA
Root --> LeafB
subgraph LeafA["叶子页 A"]
A1["[1] 张三, 20, 88.5"]
A2["[2] 李四, 21, 92.0"]
end
subgraph LeafB["叶子页 B"]
B1["[3] 王五, 19, 76.5"]
B2["[4] 赵六, 22, 95.0"]
B3["[5] 张三, 23, 81.0"]
end
LeafA <--->|双向链表| LeafB
style Root fill:#4A90D9,color:#fff
style A1 fill:#67C23A,color:#fff
style A2 fill:#67C23A,color:#fff
style B1 fill:#67C23A,color:#fff
style B2 fill:#67C23A,color:#fff
style B3 fill:#67C23A,color:#fff
```

- `SELECT * FROM student WHERE id = 4`→ 直接在 B+Tree 定位，一次查找拿到整行

---

## 2. 二级索引（idx_name）

叶子节点只存 索引列 + 主键 id，不含其他列。

```mermaid
graph TD
Root["非叶子节点 [王五]"]
Root --> LeafA
Root --> LeafB
subgraph LeafA["叶子页 A"]
A1["张三 → id=1"]
A2["张三 → id=5"]
A3["李四 → id=2"]
end
subgraph LeafB["叶子页 B"]
B1["王五 → id=3"]
B2["赵六 → id=4"]
end
LeafA <--->|双向链表| LeafB
style Root fill:#E6A23C,color:#fff
style A1 fill:#F5DEB3
style A2 fill:#F5DEB3
style A3 fill:#F5DEB3
style B1 fill:#F5DEB3
style B2 fill:#F5DEB3
```

- 叶子节点只有`name + id`，没有 age、score
- 按 name 排序，不是按 id 排序

---

## 3. 回表过程

```sql
SELECT * FROM student WHERE name = '张三';

```

```mermaid
sequenceDiagram
participant C as 客户端
participant S as Server 层
participant IDX as 二级索引 idx_name
participant PK as 聚簇索引 (主键)
C->>S: SELECT * WHERE name='张三'
S->>IDX: 查找 name='张三'
IDX-->>S: 命中 id=1, id=5
Note over S,PK: 回表：拿 id 去聚簇索引查完整行
S->>PK: 查找 id=1
PK-->>S: (1, 张三, 20, 88.5) ✅
S->>PK: 查找 id=5
PK-->>S: (5, 张三, 23, 81.0) ✅
S-->>C: 返回 2 条完整记录
Note over IDX,PK: 总计：1 次索引查找 + 2 次回表 = 3 次 B+Tree 查找
```

---

## 4. 覆盖索引（免回表）

联合索引`idx_name_age`的 B+Tree：

```mermaid
graph TD
Root["非叶子节点 [王五, 19]"]
Root --> LeafA
Root --> LeafB
subgraph LeafA["叶子页 A"]
A1["(张三, 20) → id=1"]
A2["(张三, 23) → id=5"]
A3["(李四, 21) → id=2"]
end
subgraph LeafB["叶子页 B"]
B1["(王五, 19) → id=3"]
B2["(赵六, 22) → id=4"]
end
LeafA <--->|双向链表| LeafB
style Root fill:#9B59B6,color:#fff
style A1 fill:#D7BDE2
style A2 fill:#D7BDE2
style A3 fill:#D7BDE2
style B1 fill:#D7BDE2
style B2 fill:#D7BDE2
```

```sql
SELECT name, age FROM student WHERE name = '张三';

```

```mermaid
sequenceDiagram
participant C as 客户端
participant S as Server 层
participant IDX as 联合索引 idx_name_age
C->>S: SELECT name, age WHERE name='张三'
S->>IDX: 查找 name='张三'
IDX-->>S: (张三, 20) ✅ name和age都在索引中
IDX-->>S: (张三, 23) ✅ name和age都在索引中
Note over S,IDX: 索引中已包含所有查询列，无需回表！
S-->>C: 返回 2 条记录
Note over IDX: EXPLAIN Extra: Using index（覆盖索引标志）
```

---

## 5. 索引下推（Index Condition Pushdown, ICP）

MySQL 5.6 引入，核心思想：把原本在 Server 层做的索引列过滤，下推到存储引擎层提前做，减少回表次数。

```sql
-- 联合索引 INDEX idx_name_age (name, age)
SELECT * FROM student WHERE name LIKE '张%' AND age > 21;

```

`name LIKE '张%'`可以用索引最左前缀，但`age > 21`在 LIKE 之后按最左前缀原则用不上索引范围扫描。 而 age 的值其实已经存在索引叶子节点里了，ICP 就是利用这一点提前过滤。

### 无 ICP（MySQL 5.6 之前）

```mermaid
flowchart TD
A["二级索引 idx_name_age 查找 name LIKE '张%'"] -->
B["匹配到: (张三,20)→id=1 (张三,23)→id=5"]
B -->
C1["回表 id=1 → (1,张三,20,88.5)"]
B -->
C2["回表 id=5 → (5,张三,23,81.0)"]
C1 -->
D["Server 层过滤 age > 21"]
C2 --> D
D -->
E1["id=1, age=20 ✗ 丢弃"]
D -->
E2["id=5, age=23 ✓ 保留"]
style C1 fill:#F56C6C,color:#fff
style E1 fill:#F56C6C,color:#fff
style C2 fill:#67C23A,color:#fff
style E2 fill:#67C23A,color:#fff
```

回表 2 次，其中 id=1 是浪费的

### 有 ICP（MySQL 5.6+）

```mermaid
flowchart TD
A["二级索引 idx_name_age 查找 name LIKE '张%'"] -->
B["匹配到: (张三,20)→id=1 (张三,23)→id=5"]
B -->
F{"存储引擎层 直接用索引中的 age 过滤 age > 21"}
F -->|"(张三,20) age=20 ✗"| G1["跳过，不回表"]
F -->|"(张三,23) age=23 ✓"| G2["回表 id=5 → (5,张三,23,81.0)"]
G2 -->
H["Server 层直接返回"]
style G1 fill:#909399,color:#fff
style G2 fill:#67C23A,color:#fff
style F fill:#E6A23C,color:#fff
```

回表 1 次，省掉了 1 次无效回表

### 对比流程

```mermaid
flowchart LR
subgraph 无ICP
direction TB A1["索引查找 name LIKE '张%'"] -->
B1["全部回表 id=1, id=5"]
B1 -->
C1["Server 层过滤 age > 21 丢弃 id=1"]
end
subgraph 有ICP
direction TB A2["索引查找 name LIKE '张%'"] -->
B2["引擎层过滤 age > 21 跳过 id=1"]
B2 -->
C2["只回表 id=5"]
end
style B1 fill:#F56C6C,color:#fff
style C1 fill:#F56C6C,color:#fff
style B2 fill:#67C23A,color:#fff
style C2 fill:#67C23A,color:#fff
```

### EXPLAIN 怎么看

```sql
EXPLAIN SELECT * FROM student WHERE name LIKE '张%' AND age > 21;

```

| Extra 列 | 含义 |
| --- | --- |
| `Using index condition` | 使用了索引下推 |
| `Using where` | 没有 ICP，在 Server 层过滤 |

### ICP 生效条件

- InnoDB / MyISAM 引擎
- 联合索引中，最左前缀之后的列仍然能用于过滤
- 不能是覆盖索引（覆盖索引本身就不用回表，没必要下推）
- 子查询条件不支持

---

## 6. 总结对比

```mermaid
graph LR
subgraph 聚簇索引
direction TB P1["B+Tree 叶子节点"] -->
P2["id + 完整行数据"]
P2 -->
P3["SELECT * WHERE id=3 一次查找搞定"]
end
subgraph 二级索引
direction TB S1["B+Tree 叶子节点"] -->
S2["索引列 + 主键 id"]
S2 -->
S3["SELECT * WHERE name='张三' 查索引 → 拿id → 回表"]
end
subgraph 覆盖索引
direction TB C1["B+Tree 叶子节点"] -->
C2["索引列包含所有查询列"]
C2 -->
C3["SELECT name,age WHERE name='张三' 索引里全有，免回表"]
end
subgraph 索引下推
direction TB I1["存储引擎层"] -->
I2["用索引中的列提前过滤"]
I2 -->
I3["WHERE name LIKE '张%' AND age>21 减少无效回表"]
end
style P2 fill:#67C23A,color:#fff
style S2 fill:#E6A23C,color:#fff
style C2 fill:#9B59B6,color:#fff
style I2 fill:#409EFF,color:#fff
```

核心结论：聚簇索引的叶子是整行数据，二级索引的叶子是主键。查二级索引拿不到的列，就得拿主键 回表 再查一次聚簇索引。覆盖索引和索引下推都是为了 减少回表。
