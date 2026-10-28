import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Drawer, Select, Space, Tag, Alert, Slider, Table, MessagePlugin } from 'tdesign-react';
import { getPreviewInfo, setPreviewScenario, resetPreview, exportPreview, requestLog } from './engine';
import { navigationLeaves } from '../app/router/navigation';

export function PreviewControls() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(getPreviewInfo);
  const client = useQueryClient();
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.altKey && event.shiftKey && event.code === 'KeyP') { event.preventDefault(); setInfo(getPreviewInfo()); setOpen(true); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const update = (scenario: string, latency = info.latency) => {
    setPreviewScenario(scenario, latency); setInfo(getPreviewInfo()); void client.invalidateQueries();
  };
  return <>
    <Drawer visible={open} onClose={() => setOpen(false)} header="独立 Mock · 视觉预览" size="560px" footer={false}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Alert theme="info" message="全部业务操作仅修改当前浏览器的合成数据。柜体码与封面为本地示意，不连接真实柜机。页面和组件来自 v1.0.2.0 后台源码，可直接编辑 src/features 与 src/styles。" />
        <section><h3>页面目录</h3><Space breakLine>{navigationLeaves().map(page => <Button key={page.key} variant="outline" onClick={() => { window.location.assign(page.path); }}>{page.label}</Button>)}</Space></section>
        <section><h3>页面状态</h3><Select value={info.scenario} options={[{value:'normal',label:'正常数据'},{value:'empty',label:'空列表'},{value:'error',label:'请求失败'},{value:'loading',label:'慢速加载（3 秒）'}]} onChange={value => update(String(value))} /><p>响应延迟：{info.latency} ms</p><Slider value={info.latency} min={0} max={2000} step={100} onChange={value => update(info.scenario, Number(value))} /></section>
        <section><h3>示例数据</h3><Space breakLine>{Object.entries(info.counts).map(([label,count]) => <Tag key={label}>{label} · {count}</Tag>)}</Space><p>修改保存于浏览器 localStorage，刷新页面仍保留。上传文件在当前标签页内预览。</p><Space><Button theme="danger" variant="outline" onClick={() => { resetPreview(); void MessagePlugin.success('已恢复初始示例数据'); window.location.reload(); }}>恢复初始数据</Button><Button variant="outline" onClick={() => { const url=URL.createObjectURL(new Blob([exportPreview()],{type:'application/json'})); const anchor=document.createElement('a'); anchor.href=url; anchor.download='xingyu-preview-data.json'; anchor.click(); URL.revokeObjectURL(url); }}>导出 Mock 数据</Button></Space></section>
        <section><h3>最近的本地操作</h3><Table rowKey="previewRowKey" size="small" data={[...requestLog].reverse().slice(0,12).map((entry,index)=>({...entry,previewRowKey:String(index)}))} columns={[{colKey:'method',title:'操作',width:70},{colKey:'path',title:'页面请求',ellipsis:true},{colKey:'status',title:'结果',width:90}]} /></section>
      </Space>
    </Drawer>
  </>;
}
