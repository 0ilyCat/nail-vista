/**
 * AI 美甲试戴 — 手图选择 + 款式选择 + AI 生成
 */
import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Button, Upload, Spin, message, Image, Result } from 'antd';
import { UploadOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tryonAPI, stylesAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title } = Typography;

export default function TryOnPage() {
  const nav = useNavigate();
  const [hands, setHands] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedHand, setSelectedHand] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState('');

  const [loading, setLoading] = useState(false);          // 试戴 loading
  const [uploading, setUploading] = useState(false);       // 上传 loading
  const [pageLoading, setPageLoading] = useState(true);    // 页面数据加载
  const [errorMsg, setErrorMsg] = useState('');            // 试戴错误信息

  /* ──────── 登录校验 ──────── */
  const checkLogin = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.warning('请先登录后再使用AI试戴');
      nav('/login');
      return false;
    }
    return true;
  };

  /* ──────── 页面初始化 ──────── */
  useEffect(() => {
    if (!checkLogin()) return;
    const loadData = async () => {
      try {
        const [handRes, styleRes] = await Promise.all([
          tryonAPI.getHands(),
          stylesAPI.list({ page_size: 20 }),
        ]);
        setHands(handRes.data || []);
        setStyles(styleRes.data?.items || []);
      } catch {
        message.error('数据加载失败，请刷新页面重试');
      } finally {
        setPageLoading(false);
      }
    };
    loadData();
  }, []);

  /* ──────── AI 试戴 ──────── */
  const onTry = async () => {
    setErrorMsg('');
    if (!checkLogin()) return;
    if (!selectedHand || !selectedStyle) {
      message.warning('请分别选择手部照片和美甲款式');
      return;
    }

    setLoading(true);
    try {
      const res = await tryonAPI.tryOn({ hand_image_id: selectedHand, style_id: selectedStyle });
      const url = res.data?.result_url;
      if (url) {
        setResultUrl(imgUrl(url));
        message.success('AI试戴完成！');
      } else {
        setErrorMsg('生成结果为空，请重试');
      }
    } catch (e: any) {
      const status = e.response?.status;
      const detail = e.response?.data?.detail;
      if (status === 401) {
        message.error('登录已过期，请重新登录');
        nav('/login');
      } else if (status === 503) {
        setErrorMsg(typeof detail === 'string' ? detail : 'AI服务暂不可用');
      } else if (status === 504 || e.code === 'ECONNABORTED') {
        setErrorMsg('AI试戴请求超时，百炼模型响应较慢，请稍后重试');
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map((d: any) => d.msg).join('；'));
      } else {
        setErrorMsg(typeof detail === 'string' ? detail : '试戴失败，请检查网络后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ──────── 上传手图 ──────── */
  const onUploadHand = async (file: File) => {
    if (!checkLogin()) return;
    setUploading(true);
    try {
      const res = await tryonAPI.uploadHand(file);
      const record = res.data;
      setHands(prev => [...prev, record]);
      setSelectedHand(record.id);
      message.success('手图上传成功');
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        nav('/login');
      } else {
        message.error(typeof detail === 'string' ? detail : '手图上传失败');
      }
    } finally {
      setUploading(false);
    }
  };

  /* ──────── 渲染 ──────── */
  if (pageLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#8b5e6b' }}>✨ AI美甲试戴</Title>

      <Row gutter={24}>
        {/* ──── 左侧：手图选择 ──── */}
        <Col xs={24} md={8}>
          <Card
            title="选择手图"
            style={{ borderRadius: 12, border: '1px solid #f0d6dc' }}
          >
            <Upload
              beforeUpload={file => { onUploadHand(file); return false; }}
              showUploadList={false}
              accept="image/*"
            >
              <Button
                icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
                loading={uploading}
                style={{ borderRadius: 8 }}
              >
                {uploading ? '上传中...' : '上传手部照片'}
              </Button>
            </Upload>
            {hands.length === 0 ? (
              <div style={{ marginTop: 16, padding: 20, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                暂无手图，上传一张手部照片开始试戴
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hands.map(h => (
                  <div
                    key={h.id}
                    onClick={() => setSelectedHand(h.id)}
                    title={h.is_preset ? '预设手图' : '我的手图'}
                    style={{
                      border: selectedHand === h.id ? '3px solid #c77986' : '3px solid transparent',
                      borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                      width: 100, height: 100, position: 'relative',
                      transition: 'border-color .15s',
                    }}
                  >
                    <img
                      src={imgUrl(h.image_url)}
                      alt="手部照片"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {selectedHand === h.id && (
                      <div style={{
                        position: 'absolute', top: 4, right: 4,
                        background: '#c77986', color: '#fff',
                        borderRadius: '50%', width: 20, height: 20,
                        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* ──── 中间：款式选择 ──── */}
        <Col xs={24} md={8}>
          <Card
            title="选择美甲款式"
            style={{ borderRadius: 12, border: '1px solid #f0d6dc' }}
          >
            <div style={{ maxHeight: 420, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {styles.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  style={{
                    border: selectedStyle === s.id ? '3px solid #c77986' : '3px solid transparent',
                    borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                    width: 100, textAlign: 'center',
                    transition: 'border-color .15s',
                  }}
                >
                  <img
                    src={imgUrl(s.image_url)}
                    alt={s.name}
                    style={{ width: 100, height: 100, objectFit: 'cover' }}
                  />
                  <div style={{ fontSize: 11, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#c77986', fontWeight: 600, paddingBottom: 4 }}>
                    ¥{s.price}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* ──── 右侧：试戴效果 ──── */}
        <Col xs={24} md={8}>
          <Card
            title="试戴效果"
            style={{ borderRadius: 12, border: '1px solid #f0d6dc' }}
          >
            <Button
              type="primary"
              block
              onClick={onTry}
              loading={loading}
              size="large"
              disabled={!selectedHand || !selectedStyle}
              style={{ marginBottom: 16, borderRadius: 8, height: 44 }}
            >
              {loading ? 'AI正在生成中...' : '✨ 开始试戴'}
            </Button>

            {!selectedHand && (
              <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>← 请先选择手部照片</div>
            )}
            {!selectedStyle && (
              <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>← 请先选择美甲款式</div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#c77986' }} spin />} />
                <div style={{ marginTop: 12, color: '#999', fontSize: 13 }}>
                  正在调用AI模型生成试戴效果，请耐心等待...
                </div>
              </div>
            )}

            {errorMsg && !loading && (
              <Result
                status="error"
                title="试戴失败"
                subTitle={errorMsg}
                extra={<Button onClick={() => setErrorMsg('')}>关闭提示</Button>}
                style={{ padding: '16px 0' }}
              />
            )}

            {resultUrl && (
              <Image.PreviewGroup>
                <Image
                  src={resultUrl}
                  alt="试戴效果"
                  style={{ borderRadius: 8, width: '100%' }}
                  fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZkZjJmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2M3Nzk4NiI+8J+SsTwvdGV4dD48L3N2Zz4="
                />
              </Image.PreviewGroup>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
