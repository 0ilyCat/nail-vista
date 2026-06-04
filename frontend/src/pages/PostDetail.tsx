import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Spin, message, Tag, Space } from 'antd';
import { HeartOutlined, HeartFilled, ArrowLeftOutlined } from '@ant-design/icons';
import { postsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Paragraph } = Typography;

export default function PostDetailPage() {
  const { id } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    postsAPI.getDetail(Number(id)).then(res => setPost(res.data)).catch(e => message.error('加载失败')).finally(() => setLoading(false));
  }, [id]);

  const onLike = async () => {
    try {
      const res = await postsAPI.toggleLike(Number(id));
      setPost({ ...post, likes_count: res.data.likes_count, is_liked: res.data.liked });
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 401) {
        message.error('请先登录');
      } else {
        message.error(typeof detail === 'string' ? detail : '操作失败');
      }
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!post) return <div>帖子不存在</div>;

  return (
    <div style={{ maxWidth: 800, margin: '24px auto' }}>
      <Link to="/community"><Button icon={<ArrowLeftOutlined />} type="link">返回灵感广场</Button></Link>
      <Card style={{ marginTop: 12 }}>
        <img src={imgUrl(post.image_url)} alt={post.title}
          style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8 }} />
        <Title level={2} style={{ marginTop: 16, color: '#8b5e6b' }}>{post.title}</Title>
        <div style={{ color: '#999', marginBottom: 16 }}>
          {post.author_name} · ♥ {post.likes_count} · {post.content}
        </div>
        <Space>
          <Button icon={post.is_liked ? <HeartFilled style={{ color: '#c77986' }} /> : <HeartOutlined />}
            onClick={onLike}>{post.is_liked ? '已收藏' : '收藏'}</Button>
          {post.style && (
            <Link to={`/styles/${post.style.id}`}>
              <Button type="primary">¥{post.style.price} · 立即预约</Button>
            </Link>
          )}
        </Space>
      </Card>

      {/* Related posts */}
      {post.related_posts?.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Title level={4}>相关推荐</Title>
          <Row gutter={[12, 12]}>
            {post.related_posts.map((rp: any) => (
              <Col xs={12} sm={6} key={rp.id}>
                <Link to={`/community/post/${rp.id}`}>
                  <Card hoverable size="small" cover={
                    <div style={{ height: 140, overflow: 'hidden' }}>
                      <img src={imgUrl(rp.image_url)} alt={rp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  }>
                    <Card.Meta title={<span style={{ fontSize: 12 }}>{rp.title}</span>} description={`♥ ${rp.likes_count}`} />
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}
