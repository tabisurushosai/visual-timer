# visual-timer (みえるタイマー) 仕様書 v1_0
## ゴール
残り時間が円グラフ(扇形)で縮んで見える視覚タイマーのChrome拡張。時間の感覚がつかみにくい子の切替予告・見通し支援。
## 絶対制約
外部API・通信なし/chrome.storage.localのみ/権限storageのみ(alarms/notificationsは使わない。タイマーはpopup表示中にsetIntervalで動かす)/MV3・TS・Vite/UIはpopup内で完結。医療・診断をうたわない。
## 機能
分・秒で時間設定/開始・一時停止・リセット/残り時間を縮む扇形(SVG/canvas)+残り数字で表示/終了時にやさしい合図(色変化+大きな「おわり」表示、音は任意で簡易ビープのみ・既定オフ)/プリセット時間(1分/3分/5分/10分など)を保存/最後の設定を復元/i18n ja-en/無料は基本、Premium($3買い切り7日トライアル)で複数プリセット保存+色テーマ。
## 完了条件
npm run build成功・dist生成・_locales ja/en・icons16/48/128・release/visual-timer.zip生成。
