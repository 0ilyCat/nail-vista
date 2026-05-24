import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Tag, Input, Select, Spin, message, Empty, Button } from 'antd';
import { HeartOutlined, EyeOutlined, ExperimentOutlined, SearchOutlined } from '@ant-design/icons';
import { getStyles, getCategories, NailStyleItem } from '../services/api';
import FloatingAskButton from '../components/common/FloatingAskButton';

export default function StyleBrowsePage() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);

  const loadStyles = async () => {
    setLoading(true);
    try {
      const res = await getStyles({ category, search, sort, page, size: 12 });
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

  const handleSearch = () => { setPage(1); loadStyles(); };

  return (
    <div>
      {/* Filters bar */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input.Search
            placeholder="搜索美甲款式..."
            style={{ maxWidth: 280 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onSearch={handleSearch}
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            allowClear
          />
          <Select
            placeholder="全部分类"
            style={{ width: 150 }}
            value={category || undefined}
            onChange={v => { setCategory(v || ''); setPage(1); }}
            options={[
              { label: `全部分类 (${total})`, value: '' },
              ...categories.map(c => ({ label: `${c.name} (${c.count})`, value: c.name })),
            ]}
          />
          <Select
            style={{ width: 110 }}
            value={sort}
            onChange={v => { setSort(v); setPage(1); }}
            options={[
              { label: '🔥 最热', value: 'popular' },
              { label: '🆕 最新', value: 'newest' },
              { label: '📋 名称', value: 'name' },
            ]}
          />
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
            共 {total} 款
          </span>
        </div>
      </Card>

      {/* Style Grid */}
      <Spin spinning={loading}>
        {!loading && styles.length === 0 ? (
          <Empty description="暂无匹配的款式" style={{ padding: 60 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {(loading ? Array.from({ length: 8 }) : styles).map((item: any, idx) => (
              <Col key={item?.id || idx} xs={24} sm={12} md={8} lg={6}>
                {loading ? (
                  <Card>
                    <div className="skeleton" style={{ height: 160, marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '40%' }} />
                  </Card>
                ) : (
                  <Card
                    hoverable
                    className="style-card"
                    bodyStyle={{ padding: 0 }}
                    cover={
                      <div className="style-cover" style={{ height: 200, position: 'relative', overflow: 'hidden' }}>
                        {item.local_url ? (
                          <img src={item.local_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            background: `linear-gradient(135deg, ${item.color_tone || '#c0395c'}, ${item.color_tone || '#c0395c'}44, #fff)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 56 }}>💅</span>
                          </div>
                        )}
                        <Tag color="pink" style={{ position: 'absolute', top: 8, right: 8, borderRadius: 4 }}>{item.category}</Tag>

                        {/* AI 试戴浮层按钮 */}
                        <button
                          className="tryon-overlay-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/user/tryon?styleId=${item.id}`);
                          }}
                        >
                          <ExperimentOutlined style={{ fontSize: 12 }} />
                          AI 试戴
                        </button>
                      </div>
                    }
                    actions={[
                      <span key="views"><EyeOutlined style={{ marginRight: 4 }} />{item.popularity}</span>,
                      <span key="tryons"><ExperimentOutlined style={{ marginRight: 4 }} />{item.today_tryons}</span>,
                      <HeartOutlined key="fav" />,
                    ]}
                  >
                    <div style={{ padding: '12px 16px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(item.tags || []).slice(0, 3).map((t: string) => (
                          <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </Col>
            ))}
          </Row>
        )}

        {/* Pagination */}
        {total > 12 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            {Array.from({ length: Math.min(5, Math.ceil(total / 12)) }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                type={p === page ? 'primary' : 'default'}
                shape="circle"
                size="small"
                onClick={() => setPage(p)}
                style={{ margin: '0 4px' }}
              >
                {p}
              </Button>
            ))}
          </div>
        )}
      </Spin>

      {/* 悬浮"问问小美"按钮 */}
      <FloatingAskButton />
    </div>
  );
}
