# farmer-exporter

A quick script to expose farmer info on Prometheus.

```bash
git clone https://github.com/JAlbertoGonzalez/farmer-exporter
cd farmer-exporter
npm i -g pm2 yarn
yarn
pm2 start index.js
```

This script exposes a **/metrics** endpoint on port 9093.

Now include this endpoint on Prometheus scrapping by editing:

```bash
nano /etc/prometheus/prometheus.yml
```

and add this lines:

```yaml
   - job_name: 'farmer_exporter'
     static_configs:
      - targets: ['localhost:9093']
```
