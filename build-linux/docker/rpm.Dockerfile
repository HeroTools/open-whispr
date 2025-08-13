FROM fedora:39

# Install RPM build tools and dependencies
RUN dnf update -y && \
    dnf install -y \
        rpm-build \
        rpm-devel \
        rpmlint \
        rpmdevtools \
        nodejs \
        npm \
        python3 \
        python3-pip \
        git \
        which \
        file \
        && dnf clean all

# Set up RPM build environment
RUN rpmdev-setuptree

WORKDIR /workspace

# Set up environment for RPM building
ENV RPM_BUILD_DIR=/root/rpmbuild