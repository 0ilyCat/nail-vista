/**
 * AI 美甲试戴 — 选择商家 → 手图选择 + 款式选择 + AI 生成 + 重新生成 + 历史
 * 支持 URL 参数预选: ?merchant_id=X&style_id=Y
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Button, Upload, Spin, message, Image, Result,
  Pagination, Modal, Select,
} from 'antd';
import {
  UploadOutlined, LoadingOutlined, ReloadOutlined, CloseOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { tryonAPI, stylesAPI, merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title } = Typography;

export default function TryOnPage() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const goChat = () => nav('/chat');

  /* ──────── URL 参数预选 ──────── */
  const preMerchantId = Number(search.get('merchant_id')) || 0;
  const preStyleId = Number(search.get('style_id')) || 0;

  /* ──────── 商家 ──────── */
  const [merchants, setMerchants] = useState<any[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<number | null>(preMerchantId || null);

  /* ──────── 手图 / 款式 ──────── */
  const [hands, setHands] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedHand, setSelectedHand] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(preStyleId || null);
  const [resultUrl, setResultUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /* ──────── 试戴历史 ──────── */
  const [history, setHistory] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pageSize = 8;

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

  /* ──────── 加载试戴历史 ──────── */
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await tryonAPI.history({ page, page_size: pageSize });
      setHistory(res.data?.items || []);
      setHistoryTotal(res.data?.total || 0);
      setHistoryPage(page);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  /* ──────── 加载商家列表 ──────── */
  const loadMerchants = async () => {
    try {
      const res = await merchantsAPI.list({ page_size: 100 });
      setMerchants(res.data?.items || []);
    } catch { /* silent */ }
  };

  /* ──────── 加载选中商家的款式 ──────── */
  const loadStyles = async (merchantId: number) => {
    setStylesLoading(true);
    try {
      const res = await stylesAPI.list({ merchant_id: merchantId, page_size: 100 });
      const items = res.data?.items || [];
      setStyles(items);
      // 如果 URL 预选了 style_id，验证它是否属于当前商家
      if (preStyleId) {
        const found = items.find((s: any) => s.id === preStyleId);
        if (!found) setSelectedStyle(null);
      } else {
        setSelectedStyle(null);
      }
    } catch {
      setStyles([]);
    } finally {
      setStylesLoading(false);
    }
  };

  /* ──────── 页面初始化 ──────── */
  useEffect(() => {
    if (!checkLogin()) return;
    const loadData = async () => {
      try {
        const [handRes] = await Promise.all([
          tryonAPI.getHands(),
          loadMerchants(),
        ]);
        setHands(handRes.data || []);
      } catch {
        message.error('数据加载失败，请刷新页面重试');
      } finally {
        setPageLoading(false);
      }
    };
    // 恢复上次页面状态（切出再切回不丢失选择）
    const saved = localStorage.getItem('tryon_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.selectedHand) setSelectedHand(s.selectedHand);
        if (s.selectedStyle) setSelectedStyle(s.selectedStyle);
        if (s.resultUrl) setResultUrl(s.resultUrl);
        if (s.wasLoading) setLoading(true); // 保持加载动画（后端仍在生成）
        localStorage.removeItem('tryon_state');
      } catch { /* ignore */ }
    }
    loadData();
    loadHistory(1);
  }, []);

  // 持久化状态到 localStorage（页面切换前保存）
  useEffect(() => {
    const saveState = () => {
      if (selectedHand || selectedStyle || resultUrl || loading) {
        localStorage.setItem('tryon_state', JSON.stringify({
          selectedHand, selectedStyle, resultUrl,
          wasLoading: loading,
        }));
      }
    };
    window.addEventListener('beforeunload', saveState);
    return () => {
      saveState(); // 组件卸载时（路由切换）保存
      window.removeEventListener('beforeunload', saveState);
    };
  }, [selectedHand, selectedStyle, resultUrl, loading]);

  // 预选商家后自动加载款式
  useEffect(() => {
    if (selectedMerchant) {
      loadStyles(selectedMerchant);
    } else {
      setStyles([]);
      if (!preMerchantId) setSelectedStyle(null);
    }
  }, [selectedMerchant]);

  /* ──────── 商家变更 ──────── */
  const onMerchantChange = (value: number | null) => {
    setSelectedMerchant(value);
    setSelectedStyle(null);
    setResultUrl('');
    setErrorMsg('');
  };

  /* ──────── AI 试戴 ──────── */
  const onTry = async (forceRegenerate = false) => {
    setErrorMsg('');
    if (!checkLogin()) return;
    if (!selectedMerchant) { message.warning('请先选择商家'); return; }
    if (!selectedHand) { message.warning('请选择手部照片'); return; }
    if (!selectedStyle) { message.warning('请选择美甲款式'); return; }

    setLoading(true);
    try {
      const res = await tryonAPI.tryOn({
        hand_image_id: selectedHand,
        style_id: selectedStyle,
        force_regenerate: forceRegenerate,
      });
      const url = res.data?.result_url;
      if (url) {
        setResultUrl(imgUrl(url));
        message.success(forceRegenerate ? '重新生成完成！' : 'AI试戴完成！');
        loadHistory(1);
      } else {
        setErrorMsg('生成结果为空，请重试');
      }
    } catch (e: any) {
      const status = e.response?.status;
      const detail = e.response?.data?.detail;
      if (status === 401) { message.error('登录已过期，请重新登录'); nav('/login'); }
      else if (status === 503) setErrorMsg(typeof detail === 'string' ? detail : 'AI服务暂不可用');
      else if (status === 504 || e.code === 'ECONNABORTED') setErrorMsg('AI试戴请求超时，请稍后重试');
      else if (Array.isArray(detail)) setErrorMsg(detail.map((d: any) => d.msg).join('；'));
      else setErrorMsg(typeof detail === 'string' ? detail : '试戴失败，请检查网络后重试');
    } finally { setLoading(false); }
  };

  /* ──────── 上传手图 ──────── */
  const onUploadHand = async (file: File) => {
    if (!checkLogin()) return;
    setUploading(true);
    try {
      const res = await tryonAPI.uploadHand(file);
      setHands(prev => [...prev, res.data]);
      setSelectedHand(res.data.id);
      message.success('手图上传成功');
    } catch (e: any) {
      if (e.response?.status === 401) { message.error('登录已过期'); nav('/login'); }
      else message.error(e.response?.data?.detail || '手图上传失败');
    } finally { setUploading(false); }
  };

  /* ──────── 删除手图 ──────── */
  const onDeleteHand = (handId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: '确定删除该手图吗？',
      okText: '确认删除', cancelText: '取消',
      maskClosable: true,
      okButtonProps: { danger: true, style: { borderRadius: 8 } },
      cancelButtonProps: { style: { borderRadius: 8 } },
      onOk: async () => {
        try {
          await tryonAPI.deleteHand(handId);
          message.success('手图已删除');
          setHands(prev => prev.filter(h => h.id !== handId));
          if (selectedHand === handId) setSelectedHand(null);
          loadHistory(1);
        } catch (e: any) {
          message.error(e.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  /* ──────── 删除试戴历史 ──────── */
  const onDeleteHistory = (effectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条试戴历史记录吗？',
      okText: '确认删除', cancelText: '取消',
      maskClosable: true,
      okButtonProps: { danger: true, style: { borderRadius: 8 } },
      cancelButtonProps: { style: { borderRadius: 8 } },
      onOk: async () => {
        try {
          await tryonAPI.deleteHistory(effectId);
          message.success('记录已删除');
          setHistory(prev => prev.filter(h => h.id !== effectId));
          setHistoryTotal(prev => prev - 1);
        } catch (e: any) {
          message.error(e.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  /* ──────── 点击历史加载 ──────── */
  const onHistoryClick = (item: any) => {
    // 从历史记录中找到对应商家并选中
    if (item.merchant_id) setSelectedMerchant(item.merchant_id);
    setSelectedHand(item.hand_image_id);
    setSelectedStyle(item.style_id);
    setResultUrl(imgUrl(item.result_url));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ──────── 渲染 ──────── */
  if (pageLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  const merchantOptions = merchants.map(m => ({ label: m.name, value: m.id }));

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <Title level={2} style={{ color: '#222', margin: 0 }}>AI美甲试戴</Title>
        <button
          onClick={goChat}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 24,
            border: '1.5px solid #2f6f68', background: '#fff',
            color: '#2f6f68', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all .2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#f3f8f4';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(47,111,104,0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span className="ask-blob-mini" />
          问问小美
        </button>
      </div>

      <Row gutter={24}>
        {/* ──── 左侧：商家 + 手图 ──── */}
        <Col xs={24} md={8}>
          {/* 商家选择 */}
          <Card
            title={<span><ShopOutlined style={{ marginRight: 6 }} />选择商家</span>}
            style={{ borderRadius: 12, border: '1px solid #F0F0F0', marginBottom: 16 }}
          >
            <Select
              showSearch
              allowClear
              value={selectedMerchant}
              onChange={onMerchantChange}
              placeholder="请选择美甲商家"
              optionFilterProp="label"
              options={merchantOptions}
              style={{ width: '100%' }}
              notFoundContent="暂无商家"
            />
          </Card>

          {/* 手图选择 */}
          <Card
            title="选择手图"
            style={{ borderRadius: 12, border: '1px solid #F0F0F0' }}
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
                      border: selectedHand === h.id ? '3px solid #2f6f68' : '3px solid transparent',
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
                    {/* 删除按钮（左上角） */}
                    <div
                      onClick={e => onDeleteHand(h.id, e)}
                      title="删除手图"
                      style={{
                        position: 'absolute', top: 2, left: 2, zIndex: 2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.35)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, cursor: 'pointer',
                      }}
                    >
                      <CloseOutlined />
                    </div>
                    {selectedHand === h.id && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2, zIndex: 2,
                        background: '#2f6f68', color: '#fff',
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
            style={{ borderRadius: 12, border: '1px solid #F0F0F0' }}
          >
            {!selectedMerchant ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                ← 请先选择商家
              </div>
            ) : stylesLoading ? (
              <Spin size="small" style={{ display: 'block', margin: '30px auto' }} />
            ) : styles.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                该商家暂无已发布的美甲款式
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {styles.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    style={{
                      border: selectedStyle === s.id ? '3px solid #2f6f68' : '3px solid transparent',
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
                    <div style={{ fontSize: 11, color: '#2f6f68', fontWeight: 600, paddingBottom: 4 }}>
                      ¥{s.price}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* ──── 右侧：试戴效果 ──── */}
        <Col xs={24} md={8}>
          <Card
            title="试戴效果"
            style={{ borderRadius: 12, border: '1px solid #F0F0F0' }}
          >
            <Button
              type="primary"
              block
              onClick={() => onTry(false)}
              loading={loading}
              size="large"
              disabled={!selectedMerchant || !selectedHand || !selectedStyle}
              style={{ marginBottom: 12, borderRadius: 8, height: 44 }}
            >
              {loading ? 'AI正在生成中...' : '开始试戴'}
            </Button>

            {resultUrl && !loading && (
              <Button
                block
                icon={<ReloadOutlined />}
                onClick={() => onTry(true)}
                disabled={!selectedMerchant || !selectedHand || !selectedStyle}
                style={{
                  marginBottom: 12, borderRadius: 8, height: 38,
                  borderColor: '#2f6f68', color: '#2f6f68',
                }}
              >
                重新生成
              </Button>
            )}

            {!selectedMerchant && <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>← 请先选择商家</div>}
            {selectedMerchant && !selectedHand && <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>← 请选择手部照片</div>}
            {selectedMerchant && !selectedStyle && <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>← 请选择美甲款式</div>}

            {loading && (
              <div className="tryon-generating">
                <div className="tryon-generating-canvas">
                  <div className="paint-ribbon" />
                  <div className="paint-ribbon" />
                  <div className="paint-ribbon" />
                  <div className="paint-ribbon" />
                  <div className="paint-ribbon" />
                </div>
                <div className="tryon-generating-overlay">
                  <div className="gen-text">AI 正在创作...</div>
                  <div className="gen-sub">正在生成AI试戴效果图</div>
                </div>
              </div>
            )}

            {errorMsg && !loading && (
              <Result status="error" title="试戴失败" subTitle={errorMsg}
                extra={<Button onClick={() => setErrorMsg('')}>关闭提示</Button>}
                style={{ padding: '16px 0' }}
              />
            )}

            {resultUrl && (
              <Image.PreviewGroup>
                <Image src={resultUrl} alt="试戴效果" style={{ borderRadius: 8, width: '100%' }}
                  fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZkZjJmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2M3Nzk4NiI+8J+SsTwvdGV4dD48L3N2Zz4="
                />
              </Image.PreviewGroup>
            )}
          </Card>
        </Col>
      </Row>

      {/* ══════════════════════ 试戴历史 ══════════════════════ */}
      <Card
        title={<span style={{ color: '#222', fontSize: 16 }}>试戴历史</span>}
        style={{ borderRadius: 12, border: '1px solid #F0F0F0', marginTop: 24 }}
      >
        {historyLoading ? (
          <Spin style={{ display: 'block', padding: 32 }} />
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>
            暂无试戴历史，选择手图和款式开始试戴吧
          </div>
        ) : (
          <>
            <Image.PreviewGroup>
              <Row gutter={[12, 12]}>
                {history.map(item => (
                  <Col xs={12} sm={8} md={6} key={item.id}>
                    <div
                      onClick={() => onHistoryClick(item)}
                      style={{
                        borderRadius: 10, overflow: 'hidden', border: '1px solid #F0F0F0',
                        cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
                        background: '#fff', position: 'relative',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,36,66,0.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    >
                      <div
                        onClick={e => onDeleteHistory(item.id, e)}
                        title="删除此记录"
                        style={{
                          position: 'absolute', top: 6, right: 6, zIndex: 2,
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.35)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        <CloseOutlined />
                      </div>
                      <Image src={imgUrl(item.result_url)} alt={item.style_name}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZkZjJmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2M3Nzk4NiI+8J+SsTwvdGV4dD48L3N2Zz4="
                        preview={{ mask: '点击放大' }}
                      />
                      <div style={{ padding: '6px 10px 8px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.style_name || '试戴效果'}
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}
                        </div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>
            {historyTotal > pageSize && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Pagination current={historyPage} total={historyTotal} pageSize={pageSize}
                  onChange={loadHistory} size="small" />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

