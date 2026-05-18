import { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Input, Select, Spin, message } from 'antd';
import { HeartOutlined, EyeOutlined, ExperimentOutlined } from '@ant-design/icons';
import { getStyles, getCategories, NailStyleItem } from '../services/api';

export default function StyleBrowsePage() {
  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const loadStyles = async () => {
    setLoading(true);
    try {
      const res = await getStyles({ category, search, sort, page, size: 24 });
      setStyles(res.items);
      setTotal(res.total);
    } catch {
      message.error('加载款式失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadStyles(); }, [category, sort, page]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索美甲款式..."
          style={{ maxWidth: 300 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onSearch={() => loadStyles()}
        />
        <Select
          placeholder="分类筛选"
          style={{ width: 140 }}
          value={category}
          onChange={setCategory}
          options={[
            { label: '全部', value: '' },
            ...categories.map(c => ({ label: `${c.name} (${c.count})`, value: c.name })),
          ]}
        />
        <Select
          style={{ width: 120 }}
          value={sort}
          onChange={setSort}
          options={[
            { label: '最新', value: 'newest' },
            { label: '最热', value: 'popular' },
            { label: '名称', value: 'name' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {styles.map(style => (
            <Col key={style.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                cover={
                  <div style={{
                    height: 160,
                    background: `linear-gradient(135deg, ${style.color_tone || '#ff69b4'}, ${style.color_tone || '#ff69b4'}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 48,
                  }}>
                    💅
                  </div>
                }
                actions={[
                  <EyeOutlined key="view" />,
                  <ExperimentOutlined key="try" />,
                  <HeartOutlined key="fav" />,
                ]}
              >
                <Card.Meta
                  title={style.name}
                  description={
                    <div>
                      <Tag color="pink">{style.category}</Tag>
                      {style.tags?.slice(0, 2).map((t: string) => <Tag key={t}>{t}</Tag>)}
                      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                        🔥 {style.popularity}热度 · 🎨 {style.today_tryons}今日试戴
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
          {styles.length === 0 && !loading && (
            <Col span={24}><div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无款式数据</div></Col>
          )}
        </Row>
        {total > 24 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Select
              value={page}
              onChange={setPage}
              options={Array.from({ length: Math.ceil(total / 24) }, (_, i) => ({ label: `第${i + 1}页`, value: i + 1 }))}
            />
          </div>
        )}
      </Spin>
    </div>
  );
}
