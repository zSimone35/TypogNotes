#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    if let Err(error) = typognotes_lib::run() {
        let message = format!("TypogNotes non può essere avviato: {error}");
        eprintln!("{message}");
        // Without a console the only visible feedback is a native message box.
        #[cfg(windows)]
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("TypogNotes")
            .set_description(message)
            .show();
    }
}
