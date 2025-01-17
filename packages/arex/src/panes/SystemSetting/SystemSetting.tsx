import { ArexPaneFC, useTranslation } from '@arextest/arex-core';
import { Divider } from 'antd';
import React from 'react';

import DataDesensitization from './DataDesensitization';
import UserInterface from './UserInterface';

const SystemSetting: ArexPaneFC = () => {
  const { t } = useTranslation(['components']);

  return (
    <div>
      <Divider orientation='left'>{t('systemSetting.userInterface')} </Divider>
      <UserInterface />

      <Divider orientation='left'> {t('systemSetting.dataDesensitization')}</Divider>
      <DataDesensitization />
    </div>
  );
};

export default SystemSetting;
