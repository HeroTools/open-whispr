Name:           open-wispr
Version:        1.0.2
Release:        1%{?dist}
Summary:        Desktop dictation application using OpenAI Whisper

License:        MIT
URL:            https://github.com/HeroTools/open-wispr
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  nodejs >= 16
BuildRequires:  npm
Requires:       alsa-lib
Requires:       atk
Requires:       cairo
Requires:       gdk-pixbuf2
Requires:       glibc
Requires:       gtk3
Requires:       libdrm
Requires:       libX11
Requires:       libXcomposite
Requires:       libXdamage
Requires:       libXext
Requires:       libXfixes
Requires:       libXi
Requires:       libXrandr
Requires:       libXrender
Requires:       libXScrnSaver
Requires:       libXtst
Requires:       nss
Requires:       python3 >= 3.8
Requires:       pulseaudio-libs

%description
OpenWispr is a desktop dictation application that uses OpenAI Whisper for 
speech-to-text transcription. It supports both local (privacy-focused) and 
cloud (OpenAI API) processing modes.

Features include global hotkey activation, multiple language support,
always-on-top dictation interface, clipboard integration, and transcription history.

%prep
%setup -q

%build
# Built with electron-builder

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/opt/open-wispr
mkdir -p $RPM_BUILD_ROOT/usr/bin
mkdir -p $RPM_BUILD_ROOT/usr/share/applications
mkdir -p $RPM_BUILD_ROOT/usr/share/icons/hicolor/512x512/apps

cp -r * $RPM_BUILD_ROOT/opt/open-wispr/
ln -sf /opt/open-wispr/open-wispr $RPM_BUILD_ROOT/usr/bin/open-wispr

cat > $RPM_BUILD_ROOT/usr/share/applications/open-wispr.desktop << EOF
[Desktop Entry]
Name=OpenWispr
Comment=Desktop dictation application using OpenAI Whisper
Exec=open-wispr
Icon=open-wispr
Type=Application
Categories=Office;Accessibility;AudioVideo;
StartupWMClass=OpenWispr
MimeType=audio/wav;audio/mp3;audio/flac;audio/ogg;
Keywords=dictation;speech;transcription;whisper;ai;
EOF

cp assets/icon.png $RPM_BUILD_ROOT/usr/share/icons/hicolor/512x512/apps/open-wispr.png

%files
/opt/open-wispr
/usr/bin/open-wispr
/usr/share/applications/open-wispr.desktop
/usr/share/icons/hicolor/512x512/apps/open-wispr.png

%post
/bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null || :
/usr/bin/update-desktop-database &> /dev/null || :

%postun
if [ $1 -eq 0 ] ; then
    /bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null
    /usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :
fi
/usr/bin/update-desktop-database &> /dev/null || :

%posttrans
/usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :

%changelog
* Mon Jan 01 2024 OpenWispr Team <support@herotools.com> - 1.0.2-1
- Initial RPM package