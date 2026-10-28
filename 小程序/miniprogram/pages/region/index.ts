import { designAssets } from '../../shared/design/assets';
import { loadDiscoveryRegions, type DiscoveryRegion } from '../../shared/api/supply-api';
import { readDiscoveryCity, selectDiscoveryCity } from '../../shared/api/supply-api';
import { cityInitial } from '../../shared/presentation/city-initial';
const states = new WeakMap<object, { epoch: number; visible: boolean; cities: DiscoveryRegion[]; active?: { abort: () => void } }>();
function state(page: object) { let s = states.get(page); if (!s) { s = { epoch: 0, visible: true, cities: [] }; states.set(page, s); } return s; }
Page({
 data: { icons: designAssets, keyword: '', inputFocused: false, searching: false, currentRegion: '', currentCity: '全部城市', currentCityId: '', datasetId: '', hotCities: [] as DiscoveryRegion[], cityGroups: [] as { letter: string; cities: DiscoveryRegion[] }[], alphaLetters: [] as {letter:string}[], scrollIntoView: '', loading: false, errorText: '' },
 onLoad() {},
 onShow() { state(this).visible = true; const selected = readDiscoveryCity(); this.setData({ currentRegion: selected?.name ?? '', currentCity: selected?.name ?? '全部城市', currentCityId: selected?.cityId ?? '' }); return this.loadCities(); },
 async loadCities() { const s = state(this); s.active?.abort(); const epoch = ++s.epoch; const handle = loadDiscoveryRegions(); s.active = handle; s.cities = []; this.setData({ loading: true, errorText: '', cityGroups: [], hotCities: [], alphaLetters: [] });
  try { const value = await handle.promise; if (!s.visible || epoch !== s.epoch) return; s.cities = value.cities; this.setData({ datasetId: value.datasetId, hotCities: value.cities.filter(item => ['上海市', '北京市', '深圳市', '杭州市', '南京市', '成都市'].includes(item.name)) }); this.filterCities(); }
  catch (error) { if (s.visible && epoch === s.epoch) this.setData({ errorText: error instanceof Error ? error.message : '城市读取失败' }); }
  finally { if (s.visible && epoch === s.epoch) this.setData({ loading: false }); }
 },
 filterCities() { const byLetter = new Map<string, DiscoveryRegion[]>(); for (const city of state(this).cities) { if (!city.name.includes(this.data.keyword.trim())) continue; const letter = cityInitial(city.name); byLetter.set(letter, [...(byLetter.get(letter) ?? []), city]); } const cityGroups = [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, cities]) => ({ letter, cities })); this.setData({ cityGroups, alphaLetters: cityGroups.map(group => ({letter:group.letter})), searching: !!this.data.keyword.trim() }); },
 onSearchInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ keyword: String(event.detail.value ?? ''), scrollIntoView: 'city-content-top' }); this.filterCities(); },
 clearSearch() { this.setData({ keyword: '', inputFocused: true, scrollIntoView: 'city-content-top' }); this.filterCities(); },
 onSearchConfirm() { this.setData({ inputFocused: false }); wx.hideKeyboard(); },
 selectCity(event: WechatMiniprogram.TouchEvent) { const s = state(this); if (!s.visible || this.data.loading || !this.data.datasetId) return; const city = s.cities.find(item => item.id === event.currentTarget.dataset['id']); if (!city) return; selectDiscoveryCity({ datasetId: this.data.datasetId, cityId: city.id, name: city.name }); this.setData({ currentCity: city.name, currentCityId: city.id }); wx.navigateBack({ delta: 1 }); },
 selectAllCities() { selectDiscoveryCity(null); wx.navigateBack({ delta: 1 }); },
 jumpLetter(event: WechatMiniprogram.TouchEvent) { const letter = String(event.target.dataset['letter'] ?? event.currentTarget.dataset['letter'] ?? ''); if (this.data.alphaLetters.some(item=>item.letter===letter)) this.setData({ scrollIntoView: 'city-' + letter }); },
 onHide() { const s = state(this); s.visible = false; ++s.epoch; s.active?.abort(); this.setData({ loading: false }); },
 onUnload() { this.onHide(); states.delete(this); },
 onSecondaryNavigationBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }); },
 goBack() { wx.navigateBack(); },
});
