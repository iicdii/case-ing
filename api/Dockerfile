FROM public.ecr.aws/lambda/python:3.8

# Install OS packages for Pillow-SIMD
RUN yum -y install tar gzip zlib freetype-devel \
    gcc \
    ghostscript \
    lcms2-devel \
    libffi-devel \
    libimagequant-devel \
    libjpeg-devel \
    libraqm-devel \
    libtiff-devel \
    libwebp-devel \
    make \
    openjpeg2-devel \
    rh-python36 \
    rh-python36-python-virtualenv \
    sudo \
    tcl-devel \
    tk-devel \
    tkinter \
    which \
    xorg-x11-server-Xvfb \
    zlib-devel \
    && yum clean all

COPY docker-requirements.txt  ./requirements.txt
RUN  pip3 install -r requirements.txt --target ./
# Replace Pillow with Pillow-SIMD to take advantage of AVX2
RUN  pip3 uninstall -y pillow && CC="cc -mavx2" pip3 install -U --force-reinstall pillow-simd


COPY app.py ./app.py
COPY model ./model

# You can overwrite command in `serverless.yml` template
CMD ["app.handler"]
