/**
 * 灵感广场 — 小红书风格卡片 + Modal 帖子详情 + 发布弹窗
 */
import { useEffect, useState } from 'react';
import { Row, Col, Button, Input, Spin, message, Modal, Tag, Typography, Upload, Avatar } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HeartOutlined, HeartFilled, CloseOutlined, UserOutlined,
  PlusOutlined, PictureOutlined, UploadOutlined,
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

  /* ──────── 发布帖子 ──────── */
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubContent, setPubContent] = useState('');
  const [pubImages, setPubImages] = useState<File[]>([]);
  const [pubPreviews, setPubPreviews] = useState<string[]>([]);
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

  /* ══════════════════════ 发布帖子 ══════════════════════ */
  const openPublish = () => {
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录后再发布'); return; }
    setPubTitle(''); setPubContent(''); setPubImages([]); setPubPreviews([]);
    setPublishOpen(true);
  };

  const onImageSelect = (file: File) => {
    if (pubImages.length >= 3) {
      message.warning('最多上传3张图片');
      return false;
    }
    setPubImages(prev => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPubPreviews(prev => [...prev, e.target?.result as string]);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const onRemovePreview = (idx: number) => {
    setPubImages(prev => prev.filter((_, i) => i !== idx));
    setPubPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const onPublish = async () => {
    if (!pubTitle.trim()) { message.warning('请输入标题'); return; }
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); return; }

    setPubLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of pubImages) {
        const uploadRes = await postsAPI.uploadImage(file);
        imageUrls.push(uploadRes.data.image_url);
      }
      await postsAPI.create({
        title: pubTitle.trim(),
        content: pubContent.trim(),
        image_url: imageUrls[0] || '',
        images: imageUrls,
      });
      message.success('发布成功！');
      setPublishOpen(false);
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

  /* ══════════════════════ 卡片渲染 ══════════════════════ */
  const renderCard = (p: any) => (
    <div
      key={p.id}
      onClick={() => openDetail(p)}
      style={{
        borderRadius: 10, overflow: 'hidden', background: '#fff',
        border: '1px solid #F0F0F0', cursor: 'pointer',
        transition: 'transform .2s, box-shadow .2s',
        height: '100%', display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(232,112,141,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{ position: 'relative', paddingTop: '100%', background: '#FDF5F7', overflow: 'hidden' }}>
        <img
          src={imgUrl(p.image_url || (p.images?.[0] || ''))}
          alt={p.title}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {(!p.image_url && !p.images?.length) && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFB3BF', fontSize: 36 }}>💅</div>
        )}
        {(p.images?.length || 0) > 1 && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 10,
            fontSize: 11, padding: '1px 8px',
          }}>
            {p.images.length}张
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.4, marginBottom: 8 }}>{p.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Avatar
              src={p.author_avatar ? imgUrl(p.author_avatar) : undefined}
              icon={<UserOutlined />}
              size={22}
              style={{ backgroundColor: '#e0e0e0', color: '#999', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author_name || '匿名用户'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span onClick={e => { e.stopPropagation(); onLike(p.id); }}
              style={{ fontSize: 12, cursor: 'pointer', color: p.is_liked ? '#E8708D' : '#bbb' }}>{p.is_liked ? <HeartFilled /> : <HeartOutlined />} {p.likes_count}</span>
            {p.style_price > 0 && <Tag color="rgba(232,112,141,0.10)" style={{ color: '#E8708D', border: 'none', fontWeight: 600, fontSize: 12, margin: 0 }}>¥{p.style_price}</Tag>}
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════ UI ══════════════════════ */
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 0 80px' }}>
      {/* 标题行 + 发布按钮 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ color: '#222', margin: 0 }}>灵感广场</Title>
        </Col>
        <Col>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openPublish}
            style={{
              borderRadius: 24, height: 44, paddingInline: 28, fontSize: 15,
              fontWeight: 600, boxShadow: '0 2px 12px rgba(255,36,66,0.20)',
              border: 'none',
            }}>
            发布帖子
          </Button>
        </Col>
      </Row>

      {/* Tab 切换 */}
      <div style={{ marginBottom: 20 }}>
        {['recommend', 'latest'].map(t => (
          <Button key={t} type={tab === t ? 'primary' : 'default'}
            onClick={() => { setTab(t); setPage(1); }}
            style={{ marginRight: 8, borderRadius: 20, borderColor: tab === t ? undefined : '#F0F0F0', color: tab === t ? undefined : '#666' }}>
            {t === 'recommend' ? '推荐' : '最新'}
          </Button>
        ))}
      </div>

      {/* 帖子瀑布流 */}
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#ddd' }}>暂无内容</div>
          <div>还没有帖子，快来发布第一条吧</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {posts.map(p => (<Col xs={12} sm={8} md={6} key={p.id}>{renderCard(p)}</Col>))}
        </Row>
      )}

      {/* ══════════════════════ 发布弹窗 ══════════════════════ */}
      <Modal
        title={<span style={{ color: '#222', fontSize: 18, fontWeight: 600 }}>发布帖子</span>}
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={onPublish}
        confirmLoading={pubLoading}
        okText="发布"
        cancelText="取消"
        maskClosable
        width={540}
        destroyOnHidden
        okButtonProps={{ style: { borderRadius: 20, height: 38, paddingInline: 28 } }}
        cancelButtonProps={{ style: { borderRadius: 20, height: 38 } }}
        styles={{ body: { paddingTop: 8 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 标题 */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#222', fontSize: 13 }}>
              标题 <span style={{ color: '#E8708D' }}>*</span>
            </label>
            <Input
              value={pubTitle}
              onChange={e => setPubTitle(e.target.value)}
              placeholder="给帖子起个吸引人的标题..."
              maxLength={64}
              showCount
              style={{ borderRadius: 8, height: 44 }}
            />
          </div>

          {/* 正文 */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#222', fontSize: 13 }}>
              正文
            </label>
            <Input.TextArea
              value={pubContent}
              onChange={e => setPubContent(e.target.value)}
              placeholder="分享你的美甲心得、穿搭灵感..."
              rows={5}
              maxLength={500}
              showCount
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* 图片上传（多图） */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#222', fontSize: 13 }}>
              <PictureOutlined style={{ marginRight: 6 }} />图片
              <span style={{ fontWeight: 400, color: '#bbb', marginLeft: 6, fontSize: 12 }}>（可选，最多3张）</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pubPreviews.map((src, idx) => (
                <div key={idx} style={{
                  position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden',
                  border: '2px solid #F0F0F0',
                }}>
                  <img src={src} alt={`preview-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div
                    onClick={() => onRemovePreview(idx)}
                    style={{
                      position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                      borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <CloseOutlined />
                  </div>
                </div>
              ))}
              {pubImages.length < 3 && (
                <Upload beforeUpload={onImageSelect} showUploadList={false} accept="image/*">
                  <div style={{
                    width: 100, height: 100, border: '2px dashed #F0F0F0', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#E8708D', background: '#FDF5F7',
                  }}>
                    <PlusOutlined style={{ fontSize: 24 }} />
                    <span style={{ fontSize: 12, marginTop: 4 }}>添加图片</span>
                  </div>
                </Upload>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════ Modal 帖子详情 ══════════════════════ */}
      <Modal
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailPost(null); }}
        footer={null}
        maskClosable
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
            {detailPost.image_url && (
              <div style={{ background: '#FDF5F7', display: 'flex', justifyContent: 'center' }}>
                <img src={imgUrl(detailPost.image_url)} alt={detailPost.title}
                  style={{ width: '100%', maxHeight: 460, objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    src={detailPost.author_avatar ? imgUrl(detailPost.author_avatar) : undefined}
                    icon={<UserOutlined />}
                    size={40}
                    style={{ backgroundColor: '#e0e0e0', color: '#999', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>{detailPost.author_name || '匿名用户'}</div>
                    <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{detailPost.created_at ? new Date(detailPost.created_at).toLocaleDateString('zh-CN') : ''}</div>
                  </div>
                </div>
                <Button icon={detailPost.is_liked ? <HeartFilled style={{ color: '#E8708D' }} /> : <HeartOutlined />}
                  onClick={() => onLike(detailPost.id)} style={{ borderRadius: 20 }}>{detailPost.likes_count || 0}</Button>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#333', marginBottom: 8 }}>{detailPost.title}</div>
              {detailPost.content && (
                <Paragraph style={{ color: '#666', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>{detailPost.content}</Paragraph>
              )}
              {detailPost.style && (
                <div style={{ background: '#FDF5F7', borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>{detailPost.style.name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{detailPost.style.merchant_name}</div>
                  </div>
                  <Link to={`/styles/${detailPost.style.id}`} onClick={() => setDetailOpen(false)}>
                    <Button type="primary" size="small" style={{ borderRadius: 16 }}>¥{detailPost.style.price} · 查看</Button>
                  </Link>
                </div>
              )}
              {detailPost.related_posts?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#222', marginBottom: 10 }}>相关推荐</div>
                  <Row gutter={[8, 8]}>
                    {detailPost.related_posts.map((rp: any) => (
                      <Col span={8} key={rp.id}>
                        <div onClick={() => openDetail(rp)} style={{ borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid #F0F0F0' }}>
                          <div style={{ height: 100, overflow: 'hidden', background: '#FDF5F7' }}>
                            {rp.image_url && <img src={imgUrl(rp.image_url)} alt={rp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ padding: '6px 8px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rp.title}</div>
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
