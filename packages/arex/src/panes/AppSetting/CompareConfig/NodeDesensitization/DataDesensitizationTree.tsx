import { EmptyWrapper, useTranslation } from '@arextest/arex-core';
import { css } from '@emotion/react';
import { Card, Tree, Typography } from 'antd';
import { TreeProps } from 'antd/es';
import React, { FC, useMemo } from 'react';

import { useColorPrimary } from '@/hooks';
import { QueryEncryptionNode } from '@/services/ComparisonService';

import { getDataEncryptionNodes } from './utils/getDataEncryptionNodes';

type DataDesensitizationTreeProps = Omit<TreeProps, 'treeData'> & {
  loading?: boolean;
  encryptionNodeList?: QueryEncryptionNode[];
  treeData?: object;
  onEditResponse?: () => void;
};

const DataDesensitizationTree: FC<DataDesensitizationTreeProps> = (props) => {
  const { t } = useTranslation('components');

  const color = useColorPrimary();

  const treeData = useMemo(
    () => getDataEncryptionNodes(props.treeData || {}, '', props.encryptionNodeList, color.name),
    [props.treeData, props.encryptionNodeList, color.name],
  );

  return (
    <Card
      size='small'
      title={<Typography.Text ellipsis>{t('appSetting.chooseOneNode')}</Typography.Text>}
    >
      <EmptyWrapper
        loading={props.loading}
        description={t('appSetting.emptyContractTip')}
        empty={!treeData?.length}
      >
        <Tree
          showIcon
          defaultExpandAll
          height={800}
          {...props}
          selectedKeys={[]}
          treeData={treeData}
          css={css`
            max-height: calc(100vh - 300px);
            overflow-y: auto;
            .ant-tree-icon__customize {
              float: right;
            }
          `}
        />
      </EmptyWrapper>
    </Card>
  );
};

export default DataDesensitizationTree;
