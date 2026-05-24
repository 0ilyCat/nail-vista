import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Upload, Button, Select, Spin, message, Empty, Typography, Tooltip } from 'antd';
import { UploadOutlined, ExperimentOutlined, ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { uploadHand, startTryOn, getStyles, getHandImages, HandInfo, NailStyleItem, TryOnResult } from '../services/api';
import FloatingAskButton from '../components/common/FloatingAskButton';

const { Text } = Typography;

export default function TryOnPage() {
  const [searchParams] = useSearchParams();
  const preselectedStyleId = searchParams.get('styleId');

  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [handImages, setHandImages] = useState<HandInfo[]>([]);
  const [handId, setHandId] = useState<string | null>(null);
  const [handPreview, setHandPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(
    preselectedStyleId ? Number(preselectedStyleId) : null
  );
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [styleRes, hands] = await Promise.all([getStyles({ size: 50 }), getHandImages()]);
      setStyles(styleRes.items);
      setHandImages(hands);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const res = await uploadHand(file);
      setHandId(res.hand_id);
      setHandPreview(res.image_url);
      setResult(null);
      message.success('上传成功！');
      loadData();
    } catch { message.error('上传失败'); }
    finally { setUploadLoading(false); }
    return false;
  };

  const handleSelectHand = (h: HandInfo) => {
    setHandId(h.id);
    setHandPreview(h.url);
    setResult(null);
  };

  const handleTryOn = async () => {
    if (!handId || !selectedStyle) { message.warning('请选择手图和款式'); return; }
    setTryonLoading(true);
    try {
      const res = await startTryOn(handId, selectedStyle);
      setResult(res);
      message.success(`试戴完成！(${res.source}, ${res.duration_ms}ms)`);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '处理失败');
    } finally { setTryonLoading(false); }
  };

  const handleReset = () => {
    setHandId(null);
    setHandPreview(null);
    setSelectedStyle(null);
    setResult(null);
  };

  const selectedStyleObj = styles.find(s => s.id === selectedStyle);
  const COL_WIDTH = '1fr';

  return (
    <div>
      {/* Three-column equal-width layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${COL_WIDTH})`,
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-2xl)',
      }}>
        {/* Column 1: Hand Photo */}
        <Card
          className="gradient-border-subtle"
          title={<span style={{ fontWeight: 600 }}>① 选择手部照片</span>}
          extra={handPreview && <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>重选</Button>}
        >
          {/* Large preview */}
          <div className={`preview-area-gradient ${handPreview ? 'has-image' : ''}`} style={{ marginBottom: 12 }}>
            {handPreview ? (
              <img src={handPreview} alt="已选手图" />
            ) : (
              <div className="preview-placeholder">
                <UploadOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                <span style={{ fontSize: 13 }}>选择手部照片</span>
              </div>
            )}
          </div>

          {/* Upload */}
          <Upload.Dragger
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploadLoading}
            style={{ padding: '8px 0', marginBottom: 12 }}
          >
            {uploadLoading ? <Spin /> : (
              <div>
                <UploadOutlined style={{ fontSize: 18, color: 'var(--primary)' }} />
                <p style={{ marginTop: 2, fontSize: 12 }}>点击/拖拽上传新照片</p>
              </div>
            )}
          </Upload.Dragger>

          {/* History thumbnails */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <HistoryOutlined style={{ marginRight: 4 }} />
            历史记录 ({handImages.length})
          </div>
          <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {handImages.map(h => (
              <Tooltip key={h.id} title={h.name} placement="top">
                <div onClick={() => handleSelectHand(h)} style={{
                  width: 56, height: 56, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  border: handId === h.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                  boxShadow: handId === h.id ? '0 0 0 2px var(--primary-glow)' : 'none',
                  transition: 'all 0.2s var(--ease-out-quart)',
                  opacity: handId && handId !== h.id ? 0.6 : 1,
                }}>
                  <img src={h.url} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </Tooltip>
            ))}
            {handImages.length === 0 && !loading && (
              <div style={{ width: '100%', textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                暂无记录
              </div>
            )}
          </div>
        </Card>

        {/* Column 2: Nail Style */}
        <Card
          className="gradient-border-subtle"
          title={<span style={{ fontWeight: 600 }}>② 选择美甲款式</span>}
        >
          {/* Large preview */}
          <div className={`preview-area-gradient ${selectedStyleObj ? 'has-image' : ''}`} style={{ marginBottom: 12 }}>
            {selectedStyleObj ? (
              selectedStyleObj.local_url ? (
                <img src={selectedStyleObj.local_url} alt={selectedStyleObj.name} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: `linear-gradient(135deg, ${selectedStyleObj.color_tone}, ${selectedStyleObj.color_tone}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 64 }}>💅</span>
                </div>
              )
            ) : (
              <div className="preview-placeholder">
                <ExperimentOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                <span style={{ fontSize: 13 }}>选择美甲款式</span>
              </div>
            )}
          </div>

          {/* Search & swatches */}
          <Select
            showSearch
            placeholder="搜索款式..."
            style={{ width: '100%', marginBottom: 12 }}
            value={selectedStyle}
            onChange={setSelectedStyle}
            filterOption={(input, option) => (option?.label as string || '').includes(input)}
            options={styles.map(s => ({ label: s.name, value: s.id }))}
            loading={loading}
          />

          <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {styles.map(s => (
              <div key={s.id} onClick={() => setSelectedStyle(s.id)}
                className={`nail-swatch ${selectedStyle === s.id ? 'selected' : ''}`}
                style={{
                  width: 56, height: 56, borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                  border: selectedStyle === s.id ? '2px solid var(--primary)' : '2px solid transparent',
                  boxShadow: selectedStyle === s.id ? '0 0 0 2px var(--primary-glow)' : '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s var(--ease-out-quart)', position: 'relative',
                }}>
                {s.local_url ? (
                  <img src={s.local_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: `linear-gradient(135deg, ${s.color_tone}, ${s.color_tone}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{s.name.slice(0, 2)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Try-on CTA */}
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleTryOn}
            loading={tryonLoading}
            block
            style={{ marginTop: 16, height: 42, fontSize: 14 }}
            size="large"
            disabled={!handId || !selectedStyle}
          >
            {tryonLoading ? 'AI 生成中...' : selectedStyleObj ? `试戴「${selectedStyleObj.name}」` : '请选择手图和款式'}
          </Button>
        </Card>

        {/* Column 3: Result */}
        <Card
          className="gradient-border-subtle"
          title={<span style={{ fontWeight: 600 }}>③ 试戴效果</span>}
          ref={resultRef as any}
        >
          {tryonLoading ? (
            <div className="tryon-generating">
              <div className="tryon-generating-canvas">
                <div className="paint-blob" />
                <div className="paint-blob" />
                <div className="paint-blob" />
                <div className="paint-blob" />
              </div>
              <div className="gen-strokes" />
              <div className="tryon-generating-overlay">
                <div className="gen-text">✨ AI 正在创作...</div>
                <div className="gen-sub">正在生成AI试戴效果图</div>
              </div>
            </div>
          ) : result ? (
            <div className="tryon-result-fade-in">
              <div className="result-image-container" style={{ borderRadius: 'var(--radius-lg)', marginBottom: 12 }}>
                <img src={result.result_url} alt="试戴效果" style={{ width: '100%', borderRadius: 'var(--radius-lg)' }} />
                <div className="result-overlay">
                  <div style={{ fontWeight: 600 }}>{result.style_name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                    {result.source === 'bailian-cached' ? '百炼AI缓存' : result.source === 'bailian-live' ? '百炼AI实时生成' : 'OpenCV合成'} · {result.duration_ms}ms
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button block onClick={handleReset} icon={<ReloadOutlined />}>重新试戴</Button>
                <Button block type="primary" onClick={() => setSelectedStyle(null)}>换款式</Button>
              </div>
            </div>
          ) : (
            <Empty
              description={
                <span style={{ color: 'var(--text-muted)' }}>
                  {handPreview ? '点击「开始试戴」查看效果' : '选择手图和款式后查看'}
                </span>
              }
            />
          )}
        </Card>
      </div>

      {/* 悬浮"问问小美"按钮 */}
      <FloatingAskButton />
    </div>
  );
}
