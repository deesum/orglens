# Config Reverse Engineer Agent Package Directory

Only metadata for the Config Reverse Engineer Agent should be added under:

- `apps/config-reverse-engineer-agent/force-app/main/default`

Do not add unrelated Field Service or legacy metadata to this directory.

## Targeted Deploy Commands

Deploy only this app path:

```bash
sf project deploy start --source-dir apps/config-reverse-engineer-agent/force-app --target-org <alias>
```

Deploy only components listed in this app manifest:

```bash
sf project deploy start --manifest manifest/config-reverse-engineer-agent/package.xml --target-org <alias>
```
