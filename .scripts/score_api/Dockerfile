FROM ubuntu:16.04

#Install deb packages
RUN apt-get update && apt-get install -y \
        vim \
        curl \
        build-essential \
        git \
        python-pip \
        python3 \
        python3-dev \
        g++ \
        make \
    && \
    apt-get clean all

#Install pip packages
RUN pip install virtualenv

COPY . /app

RUN virtualenv --python=/usr/bin/python3 venv &&\
    . /venv/bin/activate &&\
    cd /app &&\
    pip install -r /app/requirements.pip

ENV WORKER_MODE "true"
ENV WORKERS 2
ENV MONGO_HOST ""
ENV BROKER_URL ""

RUN echo "#!/bin/bash\n\
cd /app\n\
if [ "$WORKER_MODE" = "true" ]; then\n\
/venv/bin/celery worker -A tasks --loglevel=INFO --concurrency=$WORKERS\n\
else\n\
/venv/bin/python server.py\n\
fi" > /run.sh && chmod a+x /run.sh

CMD "/run.sh"
