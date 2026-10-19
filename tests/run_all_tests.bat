@echo off
setlocal
cd /d "%~dp0.."

echo [1/13] JavaScript syntax...
for %%F in (extension\src\*.js extension\*.js) do node --check "%%F" || goto :fail

echo [2/13] Python syntax...
python -m py_compile local-server\bridge_server.py || goto :fail

echo [3/13] Caption utilities...
node extension\src\caption-utils.test.js || goto :fail

echo [4/13] Meet caption engine...
node extension\src\meet-caption-engine.test.js || goto :fail

echo [5/13] Speaker filtering...
node extension\src\speaker-utils.test.js || goto :fail

echo [6/13] Utterance/question logic...
node tests\test_utterance_utils.js || goto :fail

echo [7/13] Interview processor...
node tests\test_interview_processor.js || goto :fail
node tests\test_stability_regression_v093.js || goto :fail
node tests\test_fast_question_streaming_v094.js || goto :fail

echo [8/13] Supplied-video regression...
node tests\test_video_regression_v090.js || goto :fail

echo [9/13] Stress + queue/protocol...
node tests\test_stress.js || goto :fail
python tests\test_content_queue_regression.py || goto :fail
python tests\test_protocol_regression_v093.py || goto :fail

echo [10/13] Privacy/window architecture...
python tests\test_privacy_window.py || goto :fail

echo [11/13] Bridge tests...
python local-server\test_bridge.py || goto :fail
python local-server\test_bridge_integration.py || goto :fail

echo [12/13] Package validation...
python tests\validate_package.py || goto :fail

echo [13/13] Done...

echo.
echo ALL TESTS PASSED
exit /b 0

:fail
echo.
echo TEST FAILURE
exit /b 1
