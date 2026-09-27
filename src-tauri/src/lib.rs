mod commands;
mod db;
mod editor;
mod export;
mod models;

use tauri::{Manager, PhysicalSize};
use tauri_plugin_window_state::{StateFlags, WindowExt};

pub fn run() -> tauri::Result<()> {
    let window_flags = StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED;
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_flags)
                .skip_initial_state("main")
                .build(),
        )
        .setup(move |app| {
            let state = db::AppState::open(app.handle())?;
            app.manage(state);
            if let Some(window) = app.get_webview_window("main") {
                let state_path = app.path().app_config_dir()?.join(".window-state.json");
                if state_path.exists() {
                    if let Err(error) = window.restore_state(window_flags) {
                        eprintln!("Stato finestra ignorato: {error}");
                    }
                } else if let Some(monitor) = window.current_monitor()? {
                    let screen = monitor.size();
                    let (preferred_width, preferred_height) =
                        preferred_window_size(screen.width, screen.height);
                    // The monitor size is physical, tauri.conf.json minimums (1024×640) are logical.
                    let scale = monitor.scale_factor();
                    let width = preferred_width
                        .min(screen.width.saturating_sub(48))
                        .max((1024.0 * scale).round() as u32);
                    let height = preferred_height
                        .min(screen.height.saturating_sub(72))
                        .max((640.0 * scale).round() as u32);
                    window.set_size(PhysicalSize::new(width, height))?;
                    window.center()?;
                }
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap_app,
            commands::update_settings,
            commands::list_notes,
            commands::dashboard_overview,
            commands::list_dictionary_words,
            commands::add_dictionary_word,
            commands::check_spelling,
            commands::create_folder,
            commands::update_folder,
            commands::delete_folder,
            commands::create_note,
            commands::get_note,
            commands::save_note,
            commands::add_attachment,
            commands::read_attachment,
            commands::copy_attachment,
            commands::move_note,
            commands::archive_note,
            commands::restore_note,
            commands::trash_note,
            commands::restore_trashed_note,
            commands::delete_note,
            commands::pin_note,
            commands::set_note_attention,
            commands::reorder_notes,
            commands::export_note,
            commands::window_print,
            commands::window_close,
        ])
        .run(tauri::generate_context!())
}

fn preferred_window_size(screen_width: u32, screen_height: u32) -> (u32, u32) {
    if screen_width >= 3840 && screen_height >= 2160 {
        (3400, 1800)
    } else if screen_width >= 2560 && screen_height >= 1440 {
        (2500, 1250)
    } else {
        (1720, 940)
    }
}

#[cfg(test)]
mod tests {
    use super::preferred_window_size;

    #[test]
    fn window_size_tracks_common_monitor_resolutions() {
        assert_eq!(preferred_window_size(1920, 1080), (1720, 940));
        assert_eq!(preferred_window_size(2560, 1440), (2500, 1250));
        assert_eq!(preferred_window_size(3840, 2160), (3400, 1800));
    }
}
