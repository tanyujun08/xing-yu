import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { styleRule } from './helpers/style-contract';
type Dialog = { properties: Record<string,{value:unknown}>; methods: Record<string,(this:unknown)=>void> };
afterEach(()=>vi.unstubAllGlobals());
test('I1 order stacked actions fill the panel without changing horizontal dialog sizing',()=>{
    const css=readFileSync('miniprogram/components/confirmation-dialog/index.wxss','utf8');
    const buttons=styleRule(css,'.dialog--order.dialog--stacked .dialog__button');
    expect(buttons).toMatchObject({width:'100% !important','min-width':'100%','box-sizing':'border-box',flex:'none','align-self':'stretch'});
    expect(styleRule(css,'.dialog--order.dialog--stacked .dialog__actions')['align-items']).toBe('stretch');
    expect(styleRule(css,'.dialog__button')).toMatchObject({width:'0',flex:'1 1 0'});
    expect(styleRule(css,'.dialog--order .dialog__button')['width']).toBeUndefined();
    expect(styleRule(css,'.dialog--order .dialog__actions')['flex-direction']).toBeUndefined();
    expect(styleRule(css,'.dialog--stacked .dialog__button--primary')['order']).toBe('0');
    expect(styleRule(css,'.dialog--stacked .dialog__button--secondary')['order']).toBe('1');
});
test('shared feedback ignores hidden busy and unavailable secondary actions and never dismisses through the mask', async()=>{
    let definition!: Dialog; vi.stubGlobal('Component',(value:Dialog)=>definition=value);
    await import('../miniprogram/components/confirmation-dialog/' + 'index');
    const triggerEvent=vi.fn(); const data={visible:false,busy:false,showCancel:false}; const component={data,triggerEvent};
    definition.methods['onConfirm']!.call(component); expect(triggerEvent).not.toHaveBeenCalled();
    data.visible=true;data.busy=true;definition.methods['onConfirm']!.call(component);expect(triggerEvent).not.toHaveBeenCalled();
    data.busy=false;definition.methods['onCancel']!.call(component);definition.methods['preventMove']!.call(component);expect(triggerEvent).not.toHaveBeenCalled();
    definition.methods['onConfirm']!.call(component);expect(triggerEvent).toHaveBeenCalledExactlyOnceWith('confirm');
    data.showCancel=true;definition.methods['onCancel']!.call(component);expect(triggerEvent).toHaveBeenLastCalledWith('cancel');
});
