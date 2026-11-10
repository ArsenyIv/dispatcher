/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Циклические зависимости запрещены',
      from: {},
      to: { circular: true },
    },
    {
      name: 'modules-only-via-index',
      severity: 'error',
      comment: 'Из одного модуля в другой можно импортировать только через index.ts',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'outside-only-via-index',
      severity: 'error',
      comment: 'Код вне модулей (app, main) импортирует модули только через index.ts',
      from: { path: '^src/', pathNot: '^src/modules/' },
      to: {
        path: '^src/modules/',
        pathNot: '^src/modules/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'components-are-presentational',
      severity: 'error',
      comment: 'Компонент не импортирует api, store и контейнеры',
      from: { path: '^src/modules/[^/]+/components/' },
      to: { path: '^src/modules/[^/]+/(api|store|containers)/' },
    },
    {
      name: 'components-no-pinia',
      severity: 'error',
      comment: 'Компонент не использует Pinia',
      from: { path: '^src/modules/[^/]+/components/' },
      to: { path: 'node_modules/pinia' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.vue', '.js', '.json'],
    },
  },
}