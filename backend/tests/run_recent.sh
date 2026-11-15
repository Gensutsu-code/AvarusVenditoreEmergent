#!/bin/bash
cd /app/backend
export REACT_APP_BACKEND_URL=$(grep REACT_APP_BACKEND_URL ../frontend/.env | cut -d= -f2)
timeout 900 python -m pytest tests/test_rewards_system.py tests/test_iter114_site_features.py tests/test_iter115_feature_settings.py tests/test_iter116_admin_nav_attention.py tests/test_iter112_garage_manager_sales.py tests/test_promo_codes.py tests/test_iter109_staff_managers.py -q --tb=line -p no:cacheprovider > /app/backend/tests/recent.log 2>&1
echo DONE >> /app/backend/tests/recent.log
