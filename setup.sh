#!/bin/bash
# Скрипт для создания структуры проекта Greenlight

# Мы уже находимся в директории проекта, не нужно создавать новую
# mkdir -p greenlight-project
# cd greenlight-project

# Создаем основные директории
mkdir -p frontend/public/assets/{images/{games,icons},sounds}
mkdir -p frontend/src/{components/{common,layout,main,profile,games/{slots,mines,crash,coin},events,history},screens,services,utils,hooks,context,styles}
mkdir -p backend/src/{config,controllers,middleware,models,routes,services,utils,websocket}
mkdir -p bot/src/{commands,handlers,middleware,services,utils}
mkdir -p admin/src/{commands,handlers,middleware,services,utils}
mkdir -p common
mkdir -p docker/{frontend,backend,bot,admin,nginx}
mkdir -p scripts

# Создаем пустые файлы для структуры

# Frontend файлы
touch frontend/public/{favicon.ico,index.html,manifest.json}
touch frontend/public/assets/images/logo.png
touch frontend/public/assets/images/games/{slots.png,mines.png,crash.png,coin.png}
touch frontend/public/assets/images/icons/{home.svg,profile.svg,history.svg}
touch frontend/public/assets/sounds/{win.mp3,lose.mp3,click.mp3}

# Компоненты
touch frontend/src/components/common/{Button.js,Input.js,Modal.js,Loader.js,index.js}
touch frontend/src/components/layout/{Navigation.js,Header.js,index.js}
touch frontend/src/components/main/{BalanceDisplay.js,GameBlock.js,EventsPreview.js,index.js}
touch frontend/src/components/profile/{ProfileInfo.js,ReferralCode.js,Transactions.js,index.js}
touch frontend/src/components/games/slots/{SlotMachine.js,SlotControls.js,index.js}
touch frontend/src/components/games/mines/{MinesGrid.js,MinesControls.js,index.js}
touch frontend/src/components/games/crash/{CrashGraph.js,CrashControls.js,BetsList.js,index.js}
touch frontend/src/components/games/coin/{CoinFlip.js,CoinControls.js,index.js}
touch frontend/src/components/games/index.js
touch frontend/src/components/events/{EventList.js,EventDetails.js,PlaceBet.js,index.js}
touch frontend/src/components/history/{HistoryList.js,HistoryFilters.js,index.js}
touch frontend/src/components/index.js

# Экраны
touch frontend/src/screens/{MainScreen.js,ProfileScreen.js,HistoryScreen.js,GameScreen.js,EventsScreen.js,index.js}

# Сервисы и утилиты
touch frontend/src/services/{api.js,socket.js,auth.js,games.js,events.js,index.js}
touch frontend/src/utils/{telegram.js,formatters.js,validators.js,constants.js,storage.js,index.js}
touch frontend/src/hooks/{useBalance.js,useGame.js,useWebApp.js,index.js}
touch frontend/src/context/{AuthContext.js,GameContext.js,index.js}

# Стили
touch frontend/src/styles/{global.css,variables.css,MainScreen.css,ProfileScreen.css,HistoryScreen.css,GameScreen.css,EventsScreen.css}

# Основные файлы frontend
touch frontend/src/{App.js,index.js}
touch frontend/{package.json,package-lock.json,webpack.config.js,.babelrc,README.md}

# Backend файлы
touch backend/src/config/{database.js,telegram.js,index.js}
touch backend/src/controllers/{auth.controller.js,user.controller.js,game.controller.js,event.controller.js,payment.controller.js,index.js}
touch backend/src/middleware/{auth.middleware.js,validation.middleware.js,error.middleware.js,index.js}
touch backend/src/models/{user.model.js,game.model.js,event.model.js,transaction.model.js,referral.model.js,index.js}
touch backend/src/routes/{auth.routes.js,user.routes.js,game.routes.js,event.routes.js,payment.routes.js,index.js}
touch backend/src/services/{auth.service.js,user.service.js,game.service.js,event.service.js,payment.service.js,crypto.service.js,random.service.js,index.js}
touch backend/src/utils/{logger.js,validators.js,formatters.js,crypto.js,index.js}
touch backend/src/websocket/{handlers.js,middleware.js,index.js}
touch backend/src/{app.js,server.js}
touch backend/{package.json,package-lock.json,.env.example,.env,nodemon.json,README.md}

# Bot файлы
touch bot/src/commands/{start.command.js,help.command.js,profile.command.js,index.js}
touch bot/src/handlers/{inline.handler.js,callback.handler.js,payment.handler.js,index.js}
touch bot/src/middleware/{auth.middleware.js,logger.middleware.js,index.js}
touch bot/src/services/{user.service.js,notification.service.js,index.js}
touch bot/src/utils/{keyboard.js,messages.js,validators.js,index.js}
touch bot/src/{config.js,index.js}
touch bot/{package.json,package-lock.json,.env.example,.env,README.md}

# Admin файлы
touch admin/src/commands/{stats.command.js,events.command.js,users.command.js,index.js}
touch admin/src/handlers/{callback.handler.js,message.handler.js,index.js}
touch admin/src/middleware/{admin.middleware.js,index.js}
touch admin/src/services/{stats.service.js,admin.service.js,index.js}
touch admin/src/utils/{keyboard.js,messages.js,index.js}
touch admin/src/{config.js,index.js}
touch admin/{package.json,package-lock.json,.env.example,.env,README.md}

# Общие файлы
touch common/{constants.js,types.js,utils.js}

# Docker файлы
touch docker/frontend/Dockerfile
touch docker/backend/Dockerfile
touch docker/bot/Dockerfile
touch docker/admin/Dockerfile
touch docker/nginx/{Dockerfile,nginx.conf}
touch docker/docker-compose.yml

# Скрипты
touch scripts/{setup.sh,deploy.sh,backup.sh}

# Корневые файлы
touch {.gitignore,package.json,README.md,LICENSE}

echo "Структура проекта Greenlight успешно создана!"
echo "Вы находитесь в директории: $(pwd)"