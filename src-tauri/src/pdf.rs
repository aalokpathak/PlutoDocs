//! Native PDF export. The frontend lays the document out in a print-only
//! container; WebView2's PrintToPdf then renders it with Chromium's print
//! engine, giving vector text, real fonts and proper page breaks.

use crate::files::CmdResult;
use serde::Deserialize;
use tauri::WebviewWindow;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfOptions {
    /// Page size in inches (portrait orientation).
    page_width: f64,
    page_height: f64,
    /// Margins in inches.
    margin_top: f64,
    margin_right: f64,
    margin_bottom: f64,
    margin_left: f64,
    landscape: bool,
}

#[cfg(windows)]
#[tauri::command]
pub async fn export_pdf(window: WebviewWindow, path: String, options: PdfOptions) -> CmdResult<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE,
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows_core::{Interface, HSTRING};

    let (tx, rx) = tokio::sync::oneshot::channel::<CmdResult<()>>();
    let target = path.clone();

    window
        .with_webview(move |webview| {
            let start = || -> windows_core::Result<()> {
                unsafe {
                    let core = webview.controller().CoreWebView2()?;
                    let core7: ICoreWebView2_7 = core.cast()?;
                    let env6: ICoreWebView2Environment6 = webview.environment().cast()?;

                    let settings = env6.CreatePrintSettings()?;
                    settings.SetOrientation(if options.landscape {
                        COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
                    } else {
                        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
                    })?;
                    settings.SetPageWidth(options.page_width)?;
                    settings.SetPageHeight(options.page_height)?;
                    settings.SetMarginTop(options.margin_top)?;
                    settings.SetMarginRight(options.margin_right)?;
                    settings.SetMarginBottom(options.margin_bottom)?;
                    settings.SetMarginLeft(options.margin_left)?;
                    settings.SetShouldPrintBackgrounds(true.into())?;
                    settings.SetShouldPrintHeaderAndFooter(false.into())?;
                    settings.SetShouldPrintSelectionOnly(false.into())?;

                    let mut tx = Some(tx);
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
                        let outcome = match result {
                            Err(e) => Err(format!("PDF export failed: {e}")),
                            Ok(()) if !ok => Err("PDF export failed: the file could not be written".into()),
                            Ok(()) => Ok(()),
                        };
                        if let Some(tx) = tx.take() {
                            let _ = tx.send(outcome);
                        }
                        Ok(())
                    }));
                    core7.PrintToPdf(&HSTRING::from(target.as_str()), &settings, &handler)
                }
            };
            if let Err(e) = start() {
                // The handler (and with it `tx`) is dropped, which surfaces below as
                // a closed channel; log the underlying cause for diagnosis.
                eprintln!("PrintToPdf could not start: {e}");
            }
        })
        .map_err(|e| format!("PDF export failed: {e}"))?;

    rx.await
        .unwrap_or_else(|_| Err("PDF export is not supported by this WebView2 runtime".into()))
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn export_pdf(_window: WebviewWindow, _path: String, _options: PdfOptions) -> CmdResult<()> {
    Err("Native PDF export is only available on Windows; use Print instead".into())
}
