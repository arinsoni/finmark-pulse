FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5055
# 2 workers is plenty for a read-only status endpoint; 30s timeout covers slow CW calls
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5055", "--timeout", "30", "app:app"]
