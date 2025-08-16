FROM fedora:39

# Install Flatpak tools only (no weak deps) and clean
RUN dnf -y --setopt=install_weak_deps=False update && \
    dnf -y --setopt=install_weak_deps=False install \
        flatpak \
        flatpak-builder \
        git && \
    dnf clean all && rm -rf /var/cache/dnf

# Add flathub repository
RUN flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install required runtimes
RUN flatpak install -y flathub org.freedesktop.Platform//23.08 \
                             org.freedesktop.Sdk//23.08 \
                             org.electronjs.Electron2.BaseApp//23.08

WORKDIR /workspace

# Set environment for non-interactive builds
ENV FLATPAK_USER_DIR=/tmp/flatpak-user
ENV XDG_RUNTIME_DIR=/tmp/runtime-dir

# Create runtime directory
RUN mkdir -p /tmp/runtime-dir && chmod 700 /tmp/runtime-dir