import { useEffect, useState, useRef } from 'react';
import { Card, Upload, Button, Select, Spin, message, Empty } from 'antd';
import { UploadOutlined, ExperimentOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { uploadHand, startTryOn, getStyles, getHandImages, HandInfo, NailStyleItem, TryOnResult } from '../services/api';

export default function TryOnPage() {
  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [handImages, setHandImages] = useState<HandInfo[]>([]);
  const [handId, setHandId] = useState<string | null>(null);
  const [handPreview, setHandPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [stylesLoading, setStylesLoading] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getStyles({ size: 50 }),
      getHandImages(),
    ]).then(([styleRes, hands]) => {
      setStyles(styleRes.items);
      setHandImages(hands);
    }).finally(() => setStylesLoading(false));
  }, []);

  const handleUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const res = await uploadHand(file);
      setHandId(res.id);
      setHandPreview(res.image_url);
      setResult(null);
      message.success('上传成功！');
    } catch {
      message.error('上传失败');
    } finally {
      setUploadLoading(false);
    }
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
      const srcLabel = res.source === 'pre-generated' ? '百炼AI预生成' : '实时合成';
      message.success(`试戴完成！(${srcLabel}, ${res.duration_ms}ms)`);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '处理失败');
    } finally {
      setTryonLoading(false);
    }
  };

  const handleReset = () => { setHandId(null); setHandPreview(null); setSelectedStyle(null); setResult(null); };

  const selectedStyleObj = styles.find(s => s.id === selectedStyle);
  const step = handPreview ? (result ? 3 : 2) : 1;

  return (
    <div>
      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 }}>
        {['选择手图', '挑选款式', '查看效果'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className={`step-dot ${step > i + 1 ? 'done' : step >= i + 1 ? 'active' : ''}`}>
                {step > i + 1 ? <CheckCircleOutlined /> : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step >= i + 1 ? '#333' : '#ccc' }}>{label}</span>
            </div>
            {i < 2 && <div style={{ width: 60, height: 2, margin: '0 8px', marginBottom: 20, background: step > i + 1 ? '#52c41a' : step > i ? '#ffb6d9' : '#f0f0f0', transition: 'all 0.4s' }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Step 1: Hand image */}
        <Card title="① 选择手部照片" style={{ flex: 1, minWidth: 300, maxWidth: 380 }} extra={handPreview && <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>重选</Button>}>
          {/* Upload */}
          <Upload.Dragger accept="image/*" showUploadList={false} beforeUpload={handleUpload} disabled={uploadLoading}
            style={{ padding: '12px 0', marginBottom: 16 }}>
            {uploadLoading ? <Spin /> : handPreview && !handId?.startsWith('hand_') ? (
              <img src={handPreview} alt="手图" style={{ maxHeight: 100, borderRadius: 8 }} />
            ) : (
              <div><UploadOutlined style={{ fontSize: 28, color: '#ff69b4' }} /><p style={{ marginTop: 4, fontSize: 13 }}>上传新手图</p></div>
            )}
          </Upload.Dragger>

          {/* Hand image list */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 8 }}>预置手图 ({handImages.length}张)</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {handImages.map(h => (
              <div key={h.id} onClick={() => handleSelectHand(h)} style={{
                width: 80, height: 80, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                border: handId === h.id ? '3px solid #ff69b4' : '2px solid #eee',
                boxShadow: handId === h.id ? '0 0 0 2px rgba(255,105,180,0.2)' : 'none',
                transition: 'all 0.2s', position: 'relative',
              }}>
                <img src={h.url} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>{h.name}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Step 2: Style */}
        <Card title="② 选择美甲款式" style={{ flex: 1, minWidth: 300, maxWidth: 380 }}>
          <Select showSearch placeholder="搜索款式..." style={{ width: '100%' }} value={selectedStyle} onChange={setSelectedStyle}
            filterOption={(input, option) => (option?.label as string || '').includes(input)}
            options={styles.map(s => ({ label: s.name, value: s.id }))} size="large" loading={stylesLoading} />

          <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {styles.map(s => (
              <div key={s.id} onClick={() => setSelectedStyle(s.id)}
                className={`nail-swatch ${selectedStyle === s.id ? 'selected' : ''}`}
                style={{
                  width: 72, height: 72, borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                  border: selectedStyle === s.id ? '3px solid #ff69b4' : '3px solid transparent',
                  boxShadow: selectedStyle === s.id ? '0 0 0 2px rgba(255,105,180,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s', position: 'relative',
                }}>
                {s.local_url ? (
                  <img src={s.local_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${s.color_tone}, ${s.color_tone}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{s.name.slice(0, 2)}</span>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, textAlign: 'center', padding: '1px 0' }}>
                  {s.name.slice(0, 4)}
                </div>
              </div>
            ))}
          </div>

          <Button type="primary" icon={<ExperimentOutlined />} onClick={handleTryOn} loading={tryonLoading}
            block style={{ marginTop: 16, height: 42, fontSize: 14 }} size="large" disabled={!handId || !selectedStyle}>
            {tryonLoading ? '生成中...' : selectedStyleObj ? `试戴「${selectedStyleObj.name}」` : '请选择手图和款式'}
          </Button>
        </Card>

        {/* Step 3: Result */}
        <Card title="③ 试戴效果" style={{ flex: 1, minWidth: 300 }} ref={resultRef as any}>
          {tryonLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /><p style={{ marginTop: 12, color: '#999' }}>AI 正在生成试戴效果...</p></div>
          ) : result ? (
            <div>
              <div className="result-image-container" style={{ borderRadius: 12, marginBottom: 12 }}>
                <img src={result.result_url} alt="试戴效果" style={{ width: '100%', borderRadius: 12 }} />
                <div className="result-overlay">
                  <div style={{ fontWeight: 600 }}>{result.style_name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{result.source === 'pre-generated' ? '百炼AI预生成' : '实时合成'} · {result.duration_ms}ms</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button block onClick={handleReset} icon={<ReloadOutlined />}>重新试戴</Button>
                <Button block type="primary" onClick={() => setSelectedStyle(null)}>换款式</Button>
              </div>
            </div>
          ) : (
            <Empty description={<span style={{ color: '#ccc' }}>{handPreview ? '点击"开始试戴"查看效果' : '选择手图和款式后查看'}</span>} />
          )}
        </Card>
      </div>
    </div>
  );
}
