#!/usr/bin/env bash

#####
# This file launches the emulator and fires the tests
#####

export CELO_TEST_CONFIG=e2e

adb kill-server && adb start-server

DEFAULT_AVD="Nexus_5X_API_28_x86"

if [[ ! $(emulator -list-avds | grep ^$DEFAULT_AVD$) ]]; then
  echo "AVD $DEFAULT_AVD not installed. Pleas install it or change detox' configuration in package.json"
  echo "You can see the list of available installed devices with emulator -list-avds"
  exit 1
fi

# Just to be safe kill any process that listens on the port 'yarn start' is going to use
lsof -t -i :8081 | xargs kill -9
yarn start:bg

# This assumes pidcat
# # start logs
# pidcat -t "ReactNativeJS" > e2e_pidcat_run.log & 

yarn test:detox
STATUS=$?

 # Retry on fail logic
if [ $STATUS -ne 0 ]; then
   echo "It failed once, let's try again"
   yarn test:detox
   STATUS=$?
fi

if [ $STATUS -ne 0 ]; then
   # TODO: upload e2e_run.log and attach the link
   echo "Test failed"
else
   echo "Test passed"
fi

react-native-kill-packager

echo "Closing emulator"
kill -s 9 `ps -a | grep "Nexus_5X_API_28_x86" | grep -v "grep"  | awk '{print $1}'`

echo "Closing pidcat"
kill -s 9 `ps -a | grep "pidcat" | grep -v "grep"  | awk '{print $1}'`

exit $STATUS
