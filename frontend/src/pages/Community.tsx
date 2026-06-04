/**
 * 灵感广场 — 小红书风格卡片 + Modal 帖子详情
 */
import { useEffect, useState } from 'react';
import { Row, Col, Button, Input, Spin, message, Modal, Tag, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HeartOutlined, HeartFilled, CloseOutlined, UserOutlined,
} from '@ant-design/icons';
import { postsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Paragraph, Title } = Typography;

export default function CommunityPage() {
  const [search] = useSearchParams();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('recommend');
  const [page, setPage] = useState(1);
  const [pubTitle, setPubTitle] = useState('');
  const [pubContent, setPubContent] = useState('');
  const [pubLoading, setPubLoading] = useState(false);

  /* ──────── Modal 帖子详情 ──────── */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ══════════════════════ 列表 ══════════════════════ */
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await postsAPI.list({ tab, page, page_size: 12, search: search.get('search') || undefined });
      setPosts(res.data?.items || []);
    } catch {
      setPosts([]);
      message.error('帖子加载失败，请检查网络后重试');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(); }, [tab, page, search]);

  /* ══════════════════════ 点赞 ══════════════════════ */
  const onLike = async (postId: number) => {
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录后再点赞'); return; }
    try {
      const res = await postsAPI.toggleLike(postId);
      const updater = (p: any) => p.id === postId ? { ...p, likes_count: res.data.likes_count, is_liked: res.data.liked } : p;
      setPosts(prev => prev.map(updater));
      if (detailPost?.id === postId) {
        setDetailPost((prev: any) => ({ ...prev, likes_count: res.data.likes_count, is_liked: res.data.liked }));
      }
      message.success(res.data.liked ? '点赞成功' : '已取消点赞');
    } catch { message.error('操作失败'); }
  };

  /* ══════════════════════ 发布 ══════════════════════ */
  const onPublish = async () => {
    if (!pubTitle.trim()) { message.warning('请输入标题'); return; }
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); return; }
    setPubLoading(true);
    try {
      await postsAPI.create({ title: pubTitle, content: pubContent });
      message.success('发布成功');
      setPubTitle(''); setPubContent('');
      fetchPosts();
    } catch (e: any) { message.error(e.response?.data?.detail || '发布失败'); }
    finally { setPubLoading(false); }
  };

  /* ══════════════════════ Modal 打开帖子详情 ══════════════════════ */
  const openDetail = async (post: any) => {
    setDetailPost(post);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await postsAPI.getDetail(post.id);
      setDetailPost(res.data);
    } catch { message.error('帖子详情加载失败'); }
    finally { setDetailLoading(false); }
  };

  /* ══════════════════════ 截断文本 2 行 ══════════════════════ */
  const truncateText = (text: string, maxLen = 80) => {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  /* ══════════════════════ 卡片渲染 ══════════════════════ */
  const renderCard = (p: any) => (
    <div
      key={p.id}
      onClick={() => openDetail(p)}
      style={{
        borderRadius: 10, overflow: 'hidden', background: '#fff',
        border: '1px solid #f0d6dc', cursor: 'pointer',
        transition: 'transform .2s, box-shadow .2s',
        height: '100%', display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(199,121,134,0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* 图片区 */}
      <div style={{ position: 'relative', paddingTop: '100%', background: '#fdf2f4', overflow: 'hidden' }}>
        <img
          src={imgUrl(p.image_url)}
          alt={p.title}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            objectFit: 'cover',
          }}
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {!p.image_url && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#d4a0a8', fontSize: 36,
          }}>
            💅
          </div>
        )}
      </div>

      {/* 文字区 */}
      <div style={{ padding: '10px 12px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 标题 */}
        <div style={{ fontWeight: 600, fontSize: 14, color: '#333', marginBottom: 4, lineHeight: 1.4 }}>
          {p.title}
        </div>

        {/* 描述 — 最多 2 行 */}
        {p.content && (
          <div style={{
            fontSize: 12, color: '#999', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 8, flex: 1,
          }}>
            {p.content}
          </div>
        )}

        {/* 底部：头像昵称 + 点赞 + 价格 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', background: '#fdf2f4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#c77986', flexShrink: 0, fontWeight: 600,
            }}>
              {p.author_name?.[0] || <UserOutlined />}
            </div>
            <span style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.author_name || '匿名用户'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span onClick={e => { e.stopPropagation(); onLike(p.id); }}
              style={{ fontSize: 12, cursor: 'pointer', color: p.is_liked ? '#c77986' : '#bbb' }}>
              {p.is_liked ? <HeartFilled /> : <HeartOutlined />} {p.likes_count}
            </span>
            {p.style_price > 0 && (
              <Tag color="rgba(199,121,134,0.12)" style={{ color: '#c77986', border: 'none', fontWeight: 600, fontSize: 12, margin: 0 }}>
                ¥{p.style_price}
              </Tag>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════ UI ══════════════════════ */
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={2} style={{ color: '#8b5e6b', margin: 0 }}>💡 灵感广场</Title></Col>
      </Row>

      {/* Tab 切换 */}
      <div style={{ marginBottom: 20 }}>
        {['recommend', 'latest'].map(t => (
          <Button
            key={t}
            type={tab === t ? 'primary' : 'default'}
            onClick={() => { setTab(t); setPage(1); }}
            style={{
              marginRight: 8,
              borderRadius: 20,
              borderColor: tab === t ? undefined : '#f0d6dc',
              color: tab === t ? undefined : '#8b5e6b',
            }}
          >
            {t === 'recommend' ? '🔥 推荐' : '🕐 最新'}
          </Button>
        ))}
      </div>

      {/* 帖子瀑布流 */}
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💅</div>
          <div>还没有帖子，快来发布第一条吧</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {posts.map(p => (
            <Col xs={12} sm={8} md={6} key={p.id}>
              {renderCard(p)}
            </Col>
          ))}
        </Row>
      )}

      {/* 底部发布栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', padding: '8px 24px',
        borderTop: '1px solid #f0d6dc',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', zIndex: 10,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Input placeholder="标题" value={pubTitle} onChange={e => setPubTitle(e.target.value)} style={{ flex: 3, borderRadius: 8 }} />
          <Input placeholder="正文内容" value={pubContent} onChange={e => setPubContent(e.target.value)} style={{ flex: 5, borderRadius: 8 }} />
          <Button type="primary" onClick={onPublish} loading={pubLoading} style={{ borderRadius: 8 }}>发布</Button>
        </div>
      </div>

      {/* ══════════════════════ Modal 帖子详情 ══════════════════════ */}
      <Modal
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailPost(null); }}
        footer={null}
        width={680}
        closeIcon={<CloseOutlined style={{ color: '#fff', fontSize: 18, background: 'rgba(0,0,0,0.3)', borderRadius: '50%', padding: 4 }} />}
        styles={{ body: { padding: 0 } }}
        centered
        destroyOnHidden
      >
        {detailLoading ? (
          <Spin size="large" style={{ display: 'block', padding: '80px 0' }} />
        ) : detailPost ? (
          <div>
            {/* 大图 */}
            {detailPost.image_url && (
              <div style={{ background: '#fdf2f4', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={imgUrl(detailPost.image_url)}
                  alt={detailPost.title}
                  style={{ width: '100%', maxHeight: 460, objectFit: 'contain' }}
                />
              </div>
            )}

            <div style={{ padding: '20px 24px' }}>
              {/* 用户信息行 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#fdf2f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#c77986',
                  }}>
                    {detailPost.author_name?.[0] || <UserOutlined />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>
                      {detailPost.author_name || '匿名用户'}
                    </div>
                    <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>
                      {detailPost.created_at ? new Date(detailPost.created_at).toLocaleDateString('zh-CN') : ''}
                    </div>
                  </div>
                </div>

                <Button
                  icon={detailPost.is_liked ? <HeartFilled style={{ color: '#c77986' }} /> : <HeartOutlined />}
                  onClick={() => onLike(detailPost.id)}
                  style={{ borderRadius: 20 }}
                >
                  {detailPost.likes_count || 0}
                </Button>
              </div>

              {/* 标题 */}
              <div style={{ fontSize: 17, fontWeight: 600, color: '#333', marginBottom: 8 }}>
                {detailPost.title}
              </div>

              {/* 正文 */}
              {detailPost.content && (
                <Paragraph style={{ color: '#666', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                  {detailPost.content}
                </Paragraph>
              )}

              {/* 美甲款式链接 */}
              {detailPost.style && (
                <div style={{
                  background: '#fdf2f4', borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>{detailPost.style.name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {detailPost.style.merchant_name}
                    </div>
                  </div>
                  <Link to={`/styles/${detailPost.style.id}`} onClick={() => setDetailOpen(false)}>
                    <Button type="primary" size="small" style={{ borderRadius: 16 }}>
                      ¥{detailPost.style.price} · 查看
                    </Button>
                  </Link>
                </div>
              )}

              {/* 相关推荐 */}
              {detailPost.related_posts?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#8b5e6b', marginBottom: 10 }}>
                    相关推荐
                  </div>
                  <Row gutter={[8, 8]}>
                    {detailPost.related_posts.map((rp: any) => (
                      <Col span={8} key={rp.id}>
                        <div
                          onClick={() => openDetail(rp)}
                          style={{
                            borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                            border: '1px solid #f0d6dc',
                          }}
                        >
                          <div style={{ height: 100, overflow: 'hidden', background: '#fdf2f4' }}>
                            {rp.image_url && (
                              <img src={imgUrl(rp.image_url)} alt={rp.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                          <div style={{ padding: '6px 8px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rp.title}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 60 }}>帖子不存在</div>
        )}
      </Modal>
    </div>
  );
}
