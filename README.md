# yackage

Package your Node.js project into an executable.

This project is targeted for apps built with [Yue library][yue] and
[Yode Node.js runtime][yode].

## Install

```
npm i -g yackage
```

## Usage

```
Usage: yackage [options] [command]

Options:

  --platform <platform>  Target platform (default: $npm_config_platform ||
                         process.platform)
  --arch <arch>          Target arch (default: $npm_config_arch || process.arch)
  --app-dir <dir>        Path to the source code dir of app (default: current
                         working dir)
  --unpack <pattern>     Files to ignore when generating asar package (default:
                         *.node)
  --no-minify            Do not minify the JavaScript source code
  --extra-info-plist     The extra string to insert into the Info.plist

Commands:

  build <outputDir>      Build app bundle
  dist <outputDir>       Build app bundle and generate app distribution
```

Note that before using Yackage, the target app must have `fetch-yode` listed
as a dependency.

## Configuration

Configure your project by adding following fields to `package.json`:

```json
{
  "build": {
    "appId": "com.app.id"
    "productName": "App"
    "copyright": "Copyright © 2020 Company",
    "minify": true,
    "unpack": "+(*.node|*.png)",
    "extraInfoPlist": "<key>LSUIElement</key><true/>"
  }
}
```

Icons should put under the `build/` directory with filenames of `icon.icns`
and `icon.ico`.

## Examples

Generate executable from the app under current working directory:

```sh
cd /path/to/app/
yackage build out
```

Generate executable from path under arbitrary path:

```
yackage build out --app-dir /path/to/app
```

Generate executable for arbitrary platform:

```
yackage build out --platform win32 --arch ia32
```

Generate distributions:

```
yackage dist out --app-dir /path/to/app
```

## How yackage works

1. Run `npm pack` to generate tarball for the app.
2. Extract the tarball to temporary directory and run `npm install`.
3. Use `asar` to pacakge the app and its dependencies.
4. Append the generated ASAR archive to Yode.
5. Yode would automatically recognize the ASAR archive appended in the
   executable and start with it.

### Differences from packaging in Electron

By default yackage would unpack the `.node` files so they are not extracted
dynamically when running, otherwise anti-virus softwares would complain.

The unpacked files are placed in the `res` directory instead of the usual
`.unpacked` directory, so the final distribution would look more formal.

The `.js` files are compressed with `uglify-js` by default.

The virutal root directory of ASAR archive is `${process.execPath}/asar`. Using
`process.execPath` as virutal root directory directly would confuse Node.js
since it should be a file.

## License

Public domain.

[yue]: https://github.com/yue/yue
[yode]: https://github.com/yue/yode
[electron-builder]: https://www.electron.build/configuration/configuration
