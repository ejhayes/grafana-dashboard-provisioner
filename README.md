# grafana-dashboard-provisioner

This aims to address: https://github.com/grafana/grafana/issues/10786 by adding the following functionality to grafana dashboard provisioners:

- Update spec to allow downloading external hosted Grafana dashboards
- Allow user to specify values of to be passed to dashboard
- Non-url types are not affected

More info about provisioners can be found at:
https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards
## usage

Using an existing dashboard:

```
apiVersion: 1

providers:
- name: K6 Load Testing
  type: url
  updateIntervalSeconds: 60
  options:
    gnetId: 10660
    inputs:
      DS_INFLUXDB: my-influxdb
```

You then run this tool with:
```
# view existing dashboard provisioners
$ tree dashboards 
dashboards
└── k6.yml

# run this command
$ DEST_PATH_PREFIX='/etc/grafana/provisioning/dashboards' npx grafana-dashboard-provisioner ./dashboards ./_dashboards 
Starting...
Parsing k6.yml
Fetching dashboard: 10660
Done...

# you'll see the updated dashboard config
$ tree _dashboards 
_dashboards
├── 10660.json
└── k6.yml
```

The contents of `k6.yml` above would then look like:
```
apiVersion: 1
providers:
  - name: K6 Load Testing
    type: file
    updateIntervalSeconds: 60
    options:
      path: /etc/grafana/provisioning/dashboards/10660.json
```

If you are using this with Docker you can mount the `_dashboard` directory instead of the `dashboard` directory.
