const get = id => document.getElementById(id);

export class GardenHUD {
  constructor(app) {
    this.app = app;
    this.dialog = get('settings');
    get('openSettings')?.addEventListener('click', () => {
      this.dialog.showModal(); app.controller.keys.clear(); app._heldKeys.clear();
    });
    get('closeSettings')?.addEventListener('click', () => this.dialog.close());
    this.dialog?.addEventListener('click', e => {if(e.target === this.dialog) this.dialog.close();});
    get('volume')?.addEventListener('input', e => app.audio?.setVolume(Number(e.target.value)/100));
    get('reduceMotion')?.addEventListener('change', e => { app.reducedMotion = e.target.checked; });
    get('quality')?.addEventListener('change', e => this.setQuality(e.target.value));
    get('journalToggle')?.addEventListener('click', () => {
      const panel = get('journal'); panel.hidden = !panel.hidden;
      get('journalToggle').setAttribute('aria-expanded', String(!panel.hidden));
    });
    get('cameraMode')?.addEventListener('click', () => {
      app.overview = !app.overview;
      get('cameraMode').setAttribute('aria-pressed',String(app.overview));
      get('cameraMode').textContent = app.overview ? 'Return to walk' : 'Garden view';
      app.scene3d.dist = app.overview ? 58 : 18;
      app.scene3d.pitch = app.overview ? 0.9 : 0.44;
    });
    if(get('reduceMotion')) get('reduceMotion').checked = app.reducedMotion;
    if(get('quality')) get('quality').value = app.tier.shadows ? 'auto' : 'low';
  }
  setQuality(mode) {
    const app=this.app, renderer=app.scene3d.renderer;
    const low=mode==='low';
    renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio||1, app.tier.dpr));
    renderer.shadowMap.enabled = !low && app.tier.shadows;
    app.terrain.grass.count = low ? Math.min(1400,app.tier.grass) : app.tier.grass;
    app.scene3d.resize(); this.quality=mode;
  }
  update() {
    document.body.classList.toggle('night', this.app.scene3d.sky.night);
    const a=this.app, s=a.state.snapshot({planted:a.progress.planted,watered:a.watering.totalWatered,fed:a.feeding.totalFed});
    if(get('goalWater')) get('goalWater').textContent = Math.min(a.watering.totalWatered,5) + ' / 5';
    if(get('goalFeed')) get('goalFeed').textContent = Math.min(a.feeding.totalFed,3) + ' / 3';
    if(get('goalPlant')) get('goalPlant').textContent = Math.min(a.progress.planted,8) + ' / 8';
    if(get('goalDiscover')) get('goalDiscover').textContent = s.discovered + ' / 5';
    if(get('goalTrees')) get('goalTrees').textContent = Math.min(s.trees,3) + ' / 3';
    if(get('goalPond')) get('goalPond').textContent = s.pond ? 'Visited' : 'Find the pond';
    if(get('journeyBar')) get('journeyBar').value=s.percent;
    if(get('journeyPercent')) get('journeyPercent').textContent=s.percent+'%';
    if(get('statProgress')) get('statProgress').textContent=s.percent+'%';
    if(get('plantInfo')) {
      const f=a._focusFlower;
      get('plantInfo').hidden=!f;
      if(f) get('plantInfo').textContent=f.spec.label+' · '+(f.waterLevel<0.12?'Needs water':f.growth>=1?'In bloom':'Growing')+' · '+Math.round(f.waterLevel*100)+'% moisture';
    }
    get('btnMute')?.setAttribute('aria-pressed',String(!a.audio?.muted));
    get('btnPause')?.setAttribute('aria-pressed',String(a.paused));
    get('btnRain')?.setAttribute('aria-pressed',String(a.rain.target>0.5));
    if(get('pauseBadge')) get('pauseBadge').hidden=!a.paused;
    if(get('btnAct')) {
      const label=a.interactions.active?.getPrompt?.(a.tool);
      get('btnAct').disabled=!label || a.paused;
      get('btnAct').textContent=label || 'Explore';
    }
  }
}
