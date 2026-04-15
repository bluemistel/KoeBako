# VOICELab.

VOICEROID2 / exVOICE・自作音声ファイルを一元管理するデスクトップアプリ

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 概要

VOICELab. は、音声合成ソフトで生成した音声ファイルを整理・管理するためのデスクトップアプリです。  
キャラクターやタグによる分類、波形プレビュー再生、一括編集など、音声素材の管理に特化した機能を提供します。

## 主な機能

- **音声ファイルの取り込み・管理** — ドラッグ＆ドロップや一括取り込みに対応
- **キャラクター辞書** — キャラクター名でファイルを自動分類・管理
- **タグ管理** — 複数タグによる柔軟なフィルタリング
- **波形プレビュー** — WaveSurfer.js によるリアルタイム波形表示・再生
- **一括編集** — 複数ファイルのキャラクター・タグをまとめて変更
- **カテゴリ管理** — 音声素材製品・自作音声・カスタムカテゴリで整理
- **ダークモード / ライトモード** — テーマ切り替え対応
- **WAV / OGG / MP3 / FLAC 対応**

## 動作要件

- Windows 10 / 11 (x64)

## インストール

[Releases](../../releases) ページから最新のインストーラー（.exe）をダウンロードして実行してください。

## 使い方

1. 初回起動時に管理フォルダを設定してください（設定 → 全般）
2. 音声ファイルをドラッグ＆ドロップするか、ツールバーの「取り込み」ボタンから追加
3. キャラクター・タグを設定して整理

### キーボードショートカット

| キー | 操作 |
|------|------|
| Space | 再生 / 停止 |
| ← | 前のファイル |
| → | 次のファイル |
| Del | 選択ファイルを削除 |
| Ctrl + A | すべて選択 |
| Ctrl + B | お気に入り登録 / 解除 |
| Esc | 選択を解除 |

## バグ報告・フィードバック

不具合や改善要望は [こちらのフォーム](https://ionian-gallimimus-e47.notion.site/32b8c5bf8aa481978f37e470a25e1e01) からご報告ください。

## 技術スタック

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [sql.js](https://sql.js.org/) (WebAssembly SQLite)
- [WaveSurfer.js](https://wavesurfer.xyz/)
- [Zustand](https://zustand-demo.pmnd.rs/)

## ライセンス

[MIT License](LICENSE) © 2026 bluemistel (あおもや)

利用規約については [TERMS.md](TERMS.md) もご確認ください。
