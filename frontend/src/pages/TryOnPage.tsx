import { useEffect, useState } from 'react';
import { Card, Upload, Button, Select, Spin, message, Image } from 'antd';
import { UploadOutlined, ExperimentOutlined } from '@ant-design/icons';
import { uploadHand, startTryOn, getStyles, NailStyleItem, TryOnResult } from '../services/api';

export default function TryOnPage() {
  const [styles, setStyles] = useState<NailStyleItem[]>([]);
  const [handImageId, setHandImageId] = useState<number | null>(null);
  const [handPreview, setHandPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

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
      message.success('上传成功！');
    } catch {
      message.error('上传失败');
    } finally {
      setUploadLoading(false);
    }
    return false;
  };

  const handleTryOn = async () => {
    if (!handImageId || !selectedStyle) {
      message.warning('请先上传手部照片并选择款式');
      return;
    }
    setTryonLoading(true);
    try {
      const res = await startTryOn(handImageId, selectedStyle);
      setResult(res);
      message.success(`试戴完成！(${res.duration_ms}ms)`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '试戴处理失败');
    } finally {
      setTryonLoading(false);
    }
  };

  const selectedStyleName = styles.find(s => s.id === selectedStyle)?.name || '';

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <Card title="① 上传手部照片" style={{ flex: 1, minWidth: 280 }}>
        <Upload.Dragger
          accept="image/*"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploadLoading}
        >
          {uploadLoading ? (
            <Spin tip="上传中..." />
          ) : handPreview ? (
            <Image src={handPreview} alt="手部照片" style={{ maxHeight: 200, borderRadius: 8 }} preview={false} />
          ) : (
            <>
              <UploadOutlined style={{ fontSize: 48, color: '#ff69b4' }} />
              <p>点击或拖拽上传手部照片</p>
              <p style={{ fontSize: 12, color: '#999' }}>支持 JPG/PNG，建议手掌平放正面拍摄</p>
            </>
          )}
        </Upload.Dragger>
        {handImageId && (
          <div style={{ marginTop: 8, textAlign: 'center', color: '#999', fontSize: 12 }}>
            手图ID: {handImageId}
          </div>
        )}
      </Card>

      <Card title="② 选择美甲款式" style={{ flex: 1, minWidth: 280 }}>
        <Select
          showSearch
          placeholder="搜索或选择款式..."
          style={{ width: '100%' }}
          value={selectedStyle}
          onChange={setSelectedStyle}
          filterOption={(input, option) => (option?.label as string || '').includes(input)}
          options={styles.map(s => ({ label: s.name, value: s.id }))}
        />
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {styles.slice(0, 12).map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedStyle(s.id)}
              style={{
                width: 56, height: 56, borderRadius: 8, cursor: 'pointer',
                background: `linear-gradient(135deg, ${s.color_tone || '#ff69b4'}, ${s.color_tone || '#ff69b4'}88)`,
                border: selectedStyle === s.id ? '3px solid #ff69b4' : '3px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff', fontWeight: 500, textAlign: 'center',
                transition: 'all 0.2s',
              }}
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
          style={{ marginTop: 16, background: '#ff69b4' }}
          size="large"
          disabled={!handImageId || !selectedStyle}
        >
          {selectedStyleName ? `试戴「${selectedStyleName}」` : '开始试戴'}
        </Button>
      </Card>

      <Card title="③ 试戴效果" style={{ flex: 1, minWidth: 280 }}>
        {tryonLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#999' }}>AI正在处理试戴效果...</p>
          </div>
        ) : result ? (
          <div>
            <Image src={result.result_url} alt="试戴效果" style={{ borderRadius: 8 }} />
            <div style={{ marginTop: 12, textAlign: 'center', color: '#666', fontSize: 13 }}>
              款式: {result.style_name} · 耗时: {result.duration_ms}ms
            </div>
          </div>
        ) : handPreview ? (
          <div style={{
            height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ccc', fontSize: 16, background: '#fafafa', borderRadius: 8,
          }}>
            {selectedStyle ? '点击「开始试戴」查看效果' : '← 选择款式后试戴'}
          </div>
        ) : (
          <div style={{
            height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ccc', fontSize: 16, background: '#fafafa', borderRadius: 8,
          }}>
            上传手图后选择款式试戴
          </div>
        )}
      </Card>
    </div>
  );
}
