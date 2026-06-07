/**
 * ChartRenderer — 从 AI 输出的 ```chart``` 代码块中提取 JSON 配置并渲染 ECharts 图表
 */
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartRendererProps {
  config: string | Record<string, unknown>;
  id: string;
}

export default function ChartRenderer({ config, id }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof config === 'string' ? JSON.parse(config) : config;
    } catch {
      return;
    }

    chartInstance.current?.dispose();
    const instance = echarts.init(chartRef.current, undefined, { height: 280 });
    chartInstance.current = instance;

    const chartType = (parsed.type as string) || 'bar';

    // 构建颜色序列（小红书风格暖色系）
    const colorPalette = ['#2f6f68', '#7ba7a0', '#17413d', '#d7b46a', '#8dbbb0', '#5e8c86', '#9fb8aa', '#c9b47a'];

    const option: Record<string, unknown> = {
      title: {
        text: parsed.title as string,
        textStyle: { fontSize: 13, color: '#333', fontWeight: 600 },
        left: 'center',
        top: 5,
      },
      tooltip: {
        trigger: chartType === 'pie' ? 'item' : 'axis',
        confine: true,
      },
      color: colorPalette,
      grid: { top: 40, right: 20, bottom: 50, left: 50 },
      xAxis: chartType === 'pie' ? undefined : {
        type: 'category',
        data: parsed.xAxis as string[],
        axisLabel: { fontSize: 10, color: '#666' },
        axisLine: { lineStyle: { color: '#E0E0E0' } },
      },
      yAxis: chartType === 'pie' ? undefined : {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#666' },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      series: chartType === 'pie'
        ? [{
          type: 'pie',
          radius: ['35%', '65%'],
          center: ['50%', '55%'],
          data: ((parsed.xAxis as string[]) || []).map((name: string, idx: number) => ({
            name,
            value: ((parsed.series as Array<{ data: number[] }>)?.[0]?.data?.[idx]) || 0,
          })),
          label: { fontSize: 11 },
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        }]
        : ((parsed.series as Array<Record<string, unknown>>) || []).map((s) => ({
          ...s,
          type: chartType,
          smooth: chartType === 'line',
          itemStyle: chartType === 'bar' ? { borderRadius: [4, 4, 0, 0] } : undefined,
          barMaxWidth: 40,
        })),
    };

    if (chartType !== 'pie') {
      option.legend = {
        data: ((parsed.series as Array<{ name: string }>) || []).map(s => s.name),
        bottom: 0,
        textStyle: { fontSize: 11 },
      };
    }

    instance.setOption(option);

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
    };
  }, [config, id]);

  return (
    <div
      id={id}
      ref={chartRef}
      style={{
        width: '100%',
        height: 280,
        margin: '8px 0',
        background: '#FAFAFA',
        border: '1px solid #F0F0F0',
        borderRadius: 8,
        padding: 4,
      }}
    />
  );
}

/**
 * 从 markdown 内容中提取 ```chart``` 代码块
 */
export interface ChartConfig {
  id: string;
  config: string;
}

export function extractCharts(content: string): { cleanContent: string; charts: ChartConfig[] } {
  const charts: ChartConfig[] = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(content)) !== null) {
    try {
      const configStr = match[1].trim();
      JSON.parse(configStr);
      charts.push({ id: `chart-${Date.now()}-${idx++}`, config: configStr });
    } catch { /* skip invalid */ }
  }
  return { cleanContent: content.replace(regex, '').trim(), charts };
}

