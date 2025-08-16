FROM fedora:39

# Install RPM build tools only (no weak deps) and clean
RUN dnf -y --setopt=install_weak_deps=False update && \
    dnf -y --setopt=install_weak_deps=False install \
        rpm-build \
        rpm-devel \
        rpmlint \
        rpmdevtools \
        which \
        file && \
    dnf clean all && rm -rf /var/cache/dnf

# Set up RPM build environment
RUN rpmdev-setuptree

WORKDIR /workspace

# Set up environment for RPM building
ENV RPM_BUILD_DIR=/root/rpmbuild