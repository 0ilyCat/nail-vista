import { useEffect, useState, useRef } from 'react';
import { Card, Upload, Button, Select, Spin, message, Image, Empty } from 'antd';
import { UploadOutlined, ExperimentOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { uploadHand, startTryOn, getStyles, NailStyleItem, TryOnResult } from '../services/api';

export default function TryOnPage() {
  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [handImageId, setHandImageId] = useState<number | null>(null);
  const [handPreview, setHandPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStyles({ size: 50 }).then(res => setStyles(res.items)).catch(() => {});
  }, []);

  const handleUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const res = await uploadHand(file);
      setHandImageId(res.id);
      setHandPreview(res.image_url);
      setResult(null);
      message.success('手部照片上传成功！');
    } catch {
      message.error('上传失败，请检查文件格式');
    } finally {
      setUploadLoading(false);
    }
    return false;
  };

  const handleTryOn = async () => {
    if (!handImageId || !selectedStyle) {
      message.warning('请先完成前两步');
      return;
    }
    setTryonLoading(true);
    try {
      const res = await startTryOn(handImageId, selectedStyle);
      setResult(res);
      message.success(`试戴完成！耗时 ${res.duration_ms}ms`);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '试戴处理失败');
    } finally {
      setTryonLoading(false);
    }
  };

  const handleReset = () => {
    setHandImageId(null);
    setHandPreview(null);
    setSelectedStyle(null);
    setResult(null);
  };

  const selectedStyleName = styles.find(s => s.id === selectedStyle)?.name || '';
  const step = handPreview ? (result ? 3 : 2) : 1;

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 0 }}>
        {['上传手图', '选择款式', '查看效果'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div
                className={`step-dot ${step > i + 1 ? 'done' : step >= i + 1 ? 'active' : ''}`}
                style={step > i + 1 ? { background: '#52c41a', color: 'white' } : step >= i + 1 ? { background: '#ff69b4', color: 'white', boxShadow: '0 2px 8px rgba(255,105,180,0.4)' } : {}}
              >
                {step > i + 1 ? <CheckCircleOutlined /> : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step >= i + 1 ? '#333' : '#ccc', fontWeight: step >= i + 1 ? 500 : 400 }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{
                width: 60, height: 2, margin: '0 8px', marginBottom: 20,
                background: step > i + 1 ? '#52c41a' : step > i ? '#ffb6d9' : '#f0f0f0',
                transition: 'all 0.4s',
              }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Step 1: Upload */}
        <Card
          title={<span style={{ color: step >= 1 ? 'var(--primary)' : '#ccc' }}>① 上传手部照片</span>}
          style={{ flex: 1, minWidth: 280 }}
          extra={handPreview && <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>重新开始</Button>}
        >
          <Upload.Dragger
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploadLoading}
            style={{ borderColor: step === 1 ? '#ff69b4' : undefined }}
          >
            {uploadLoading ? (
              <div style={{ padding: 24 }}>
                <Spin />
                <p style={{ marginTop: 8, color: '#999' }}>上传中...</p>
              </div>
            ) : handPreview ? (
              <div className="result-image-container">
                <Image src={handPreview} alt="手部照片" preview={{ mask: '点击预览' }} style={{ maxHeight: 220, objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ padding: 24 }}>
                <UploadOutlined style={{ fontSize: 48, color: '#ff69b4' }} />
                <p style={{ marginTop: 8 }}>点击或拖拽上传手部照片</p>
                <p style={{ fontSize: 12, color: '#999' }}>支持 JPG/PNG，建议手掌平放正面拍摄</p>
              </div>
            )}
          </Upload.Dragger>
        </Card>

        {/* Step 2: Select Style */}
        <Card
          title={<span style={{ color: step >= 2 ? 'var(--primary)' : '#ccc' }}>② 选择美甲款式</span>}
          style={{ flex: 1, minWidth: 280 }}
        >
          <Select
            showSearch
            placeholder="搜索或选择款式..."
            style={{ width: '100%' }}
            value={selectedStyle}
            onChange={setSelectedStyle}
            filterOption={(input, option) => (option?.label as string || '').includes(input)}
            options={styles.map(s => ({ label: s.name, value: s.id }))}
            size="large"
          />
          <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {styles.slice(0, 15).map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedStyle(s.id)}
                className={`nail-swatch ${selectedStyle === s.id ? 'selected' : ''}`}
                style={{
                  width: 60, height: 60, borderRadius: 10, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${s.color_tone || '#ff69b4'}, ${s.color_tone || '#ff69b4'}88)`,
                  border: selectedStyle === s.id ? '3px solid #ff69b4' : '3px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 600, textAlign: 'center',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
                title={s.name}
              >
                {s.name.slice(0, 3)}
              </div>
            ))}
          </div>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleTryOn}
            loading={tryonLoading}
            block
            style={{ marginTop: 20, height: 44, fontSize: 15 }}
            size="large"
            disabled={!handImageId || !selectedStyle}
          >
            {tryonLoading ? 'AI 生成中...' : selectedStyleName ? `试戴「${selectedStyleName}」` : '请先完成前两步'}
          </Button>
        </Card>

        {/* Step 3: Result */}
        <Card
          title={<span style={{ color: step >= 3 ? 'var(--primary)' : '#ccc' }}>③ 试戴效果</span>}
          style={{ flex: 1, minWidth: 280 }}
          ref={resultRef as any}
        >
          {tryonLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: '#999' }}>
                <span className="skeleton" style={{ display: 'inline-block', width: 200, height: 16 }} />
              </p>
              <p style={{ fontSize: 12, color: '#ccc', marginTop: 8 }}>
                MediaPipe 检测手部关键点 → 指甲区域定位 → 透视变换合成
              </p>
            </div>
          ) : result ? (
            <div>
              <div className="result-image-container" style={{ borderRadius: 12 }}>
                <Image src={result.result_url} alt="试戴效果" style={{ borderRadius: 12 }} />
                <div className="result-overlay">
                  <div style={{ fontWeight: 600 }}>{result.style_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>处理耗时 {result.duration_ms}ms</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button block onClick={handleReset} icon={<ReloadOutlined />}>重新试戴</Button>
                <Button block type="primary" onClick={() => setSelectedStyle(null)}>换一款</Button>
              </div>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#ccc' }}>
                  {handPreview ? '点击"开始试戴"查看效果' : '上传手图并选择款式后查看'}
                </span>
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}
