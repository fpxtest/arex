import { HomeOutlined, SettingOutlined } from '@ant-design/icons';
import { DiffPath } from '@arextest/arex-common';
import {
  ArexPaneFC,
  CollapseTable,
  DiffMatch,
  getJsonValueByPath,
  getLocalStorage,
  i18n,
  I18nextLng,
  jsonIndexPathFilter,
  PaneDrawer,
  PanesTitle,
  PathHandler,
  SmallTextButton,
  TargetEditor,
  TooltipButton,
  useTranslation,
} from '@arextest/arex-core';
import { useRequest } from 'ahooks';
import { App, Button, Modal } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { EMAIL_KEY, PanesType } from '@/constant';
import { useNavPane } from '@/hooks';
import CompareConfig from '@/panes/AppSetting/CompareConfig';
import { ComparisonService, ReportService, ScheduleService } from '@/services';
import { DependencyParams } from '@/services/ComparisonService';
import { InfoItem, PlanItemStatistics, ReplayCaseType } from '@/services/ReportService';
import { MessageMap } from '@/services/ScheduleService';

import Case, { CaseProps } from './Case';
import SaveCase, { SaveCaseRef } from './SaveCase';

const ReplayCasePage: ArexPaneFC<PlanItemStatistics & { filter: number }> = (props) => {
  const { message, notification } = App.useApp();
  const email = getLocalStorage<string>(EMAIL_KEY);
  const { t } = useTranslation(['components']);
  const navPane = useNavPane();

  const [compareConfigOpen, setCompareConfigOpen] = useState<boolean>(false);

  const [targetNodePath, setTargetNodePath] = useState<string[]>();
  const [selectedRecord, setSelectedRecord] = useState<ReplayCaseType>();

  // false 不存在 DependencyId，不显示 Dependency 配置
  // undefined 未指定 DependencyId，显示所有 Dependency 配置
  // string 指定 DependencyId，显示指定 Dependency 配置
  const [selectedDependency, setSelectedDependency] = useState<InfoItem>();

  const saveCaseRef = useRef<SaveCaseRef>(null);

  const {
    data: fullLinkInfo,
    loading: loadingFullLinkInfo,
    run: getQueryFullLinkInfo,
  } = useRequest(ReportService.queryFullLinkInfo, {
    manual: true,
  });
  const fullLinkInfoMerged = useMemo<InfoItem[]>(() => {
    const { entrance, infoItemList } = fullLinkInfo || {};
    return ([{ ...entrance, isEntry: true }, ...(infoItemList || [])] as InfoItem[]).filter(
      (item) => item.id,
    );
  }, [fullLinkInfo]);

  const handleClickRecord = (record: ReplayCaseType) => {
    const selected = selectedRecord?.recordId === record.recordId ? undefined : record;
    setSelectedRecord(selected);
    if (selected) {
      getQueryFullLinkInfo({
        recordId: record.recordId,
        planItemId: props.data.planItemId,
      });
    }
  };

  const handleCaseTableChange: CaseProps['onChange'] = () => {
    setSelectedRecord(undefined);
  };

  function handleClickSaveCase(record: ReplayCaseType) {
    saveCaseRef.current?.openModal(record);
  }

  const { run: queryPlanFailCase } = useRequest(ReportService.queryPlanFailCase, {
    manual: true,
    onSuccess(operationCaseInfoList) {
      rerun({
        caseSourceFrom: +props.data.caseStartTime,
        caseSourceTo: +props.data.caseEndTime,
        appId: props.data.appId,
        operationCaseInfoList,
        operator: email as string,
        replayPlanType: 3,
        sourceEnv: 'pro',
        targetEnv: decodeURIComponent(props.data.targetEnv || ''),
      });
    },
  });

  const { run: rerun } = useRequest(ScheduleService.createPlan, {
    manual: true,

    onSuccess(res) {
      if (res.result === 1) {
        notification.success({
          message: t('replay.startSuccess'),
        });
      } else {
        notification.error({
          message: t('message.error', { ns: 'common' }),
          description: MessageMap[i18n.language as I18nextLng][res.data.reasonCode],
        });
      }
    },
  });

  const { run: insertIgnoreNode } = useRequest(
    (path: string[], global?: boolean) => {
      const dependencyParams: DependencyParams =
        global || selectedDependency?.isEntry
          ? ({} as DependencyParams)
          : {
              operationType: selectedDependency?.categoryName || selectedDependency?.operationType,
              operationName: selectedDependency?.operationName,
            };

      return ComparisonService.insertIgnoreNode({
        operationId: global ? undefined : props.data.operationId,
        appId: props.data.appId,
        exclusions: path,
        ...dependencyParams,
      });
    },
    {
      manual: true,
      onSuccess(success) {
        success && message.success(t('message.success', { ns: 'common' }));
      },
    },
  );

  function handleClickRerunCase(recordId: string) {
    queryPlanFailCase({
      planId: props.data.planId,
      planItemIdList: [props.data.planItemId],
      recordIdList: [recordId],
    });
  }

  function handleClickCompareConfigSetting(data?: InfoItem) {
    setSelectedDependency(data);
    setCompareConfigOpen(true);
  }

  const handleIgnoreKey = useCallback<PathHandler>(
    ({ path, type, targetEditor, jsonString }) => {
      const filteredPath = jsonIndexPathFilter(path, jsonString![targetEditor]);
      filteredPath && insertIgnoreNode(filteredPath, type === 'global');
    },
    [insertIgnoreNode],
  );

  const handleSortKey = useCallback<PathHandler>(({ path, type, targetEditor, jsonString }) => {
    const filteredPath = jsonIndexPathFilter(path, jsonString![targetEditor]);
    filteredPath && setTargetNodePath(filteredPath);
    setCompareConfigOpen(true);
  }, []);

  const [modal, contextHolder] = Modal.useModal();
  const handleDiffMatch = useCallback<PathHandler>(
    ({ path, targetEditor, jsonString }) => {
      const another = targetEditor === TargetEditor.left ? TargetEditor.right : TargetEditor.left;
      const text1 = getJsonValueByPath(jsonString[targetEditor], path);
      const text2 = getJsonValueByPath(jsonString[another], path);

      modal.info({
        title: t('replay.diffMatch'),
        width: 800,
        maskClosable: true,
        content: <DiffMatch text1={text1} text2={text2} />,
        footer: false,
      });
    },
    [t],
  );

  return (
    <>
      <PanesTitle
        title={
          <span>
            {t('replay.caseServiceAPI')}:{' '}
            {decodeURIComponent(props.data.operationName || 'unknown')}
          </span>
        }
        extra={
          <Button
            id='arex-replay-case-replay-report-btn'
            size='small'
            icon={<HomeOutlined />}
            onClick={() =>
              navPane({
                type: PanesType.REPLAY,
                id: props.data.appId,
              })
            }
          >
            {t('replay.replayReport')}
          </Button>
        }
      />

      <CollapseTable
        active={!!selectedRecord}
        table={
          <Case
            planId={props.data.planId}
            planItemId={props.data.planItemId}
            filter={props.data.filter}
            onClick={handleClickRecord}
            onChange={handleCaseTableChange}
            onClickSaveCase={handleClickSaveCase}
            onClickRerunCase={handleClickRerunCase}
          />
        }
        panel={
          <DiffPath
            operationId={props.data.operationId}
            extra={
              <TooltipButton
                icon={<SettingOutlined />}
                title={t('appSetting.compareConfig')}
                onClick={() => handleClickCompareConfigSetting()}
              />
            }
            itemsExtraRender={(data) => (
              <TooltipButton
                icon={<SettingOutlined />}
                title={t('appSetting.compareConfig')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClickCompareConfigSetting(data);
                }}
                style={{ marginRight: '6px' }}
              />
            )}
            loading={loadingFullLinkInfo}
            data={fullLinkInfoMerged}
            onChange={setSelectedDependency}
            onIgnoreKey={handleIgnoreKey}
            onSortKey={handleSortKey}
            onDiffMatch={handleDiffMatch}
            requestDiffMsg={ScheduleService.queryDiffMsgById}
            requestQueryLogEntity={ScheduleService.queryLogEntity}
          />
        }
      />

      <SaveCase planId={props.data.planId} operationId={props.data.operationId} ref={saveCaseRef} />

      {/* JsonDiffMathModal */}
      {contextHolder}

      {/* CompareConfigModal */}
      <PaneDrawer
        destroyOnClose
        width='70%'
        footer={false}
        title={`${t('appSetting.compareConfig')} - ${props.data.operationName}`}
        open={compareConfigOpen}
        onClose={() => {
          setCompareConfigOpen(false);
          setTargetNodePath(undefined);
        }}
      >
        <CompareConfig
          appId={props.data.appId}
          operationId={props.data.operationId || false}
          dependency={
            selectedDependency
              ? selectedDependency.isEntry
                ? false
                : {
                    operationName: selectedDependency.operationName,
                    operationType:
                      selectedDependency.categoryName || selectedDependency.operationType,
                  }
              : undefined
          }
          sortArrayPath={targetNodePath}
          onSortDrawerClose={() => setTargetNodePath(undefined)}
        />
      </PaneDrawer>
    </>
  );
};

export default ReplayCasePage;
