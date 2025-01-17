import 'chart.js/auto';

import Icon, {
  ContainerOutlined,
  DeleteOutlined,
  FileTextOutlined,
  RedoOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { ReplayLogsDrawer } from '@arextest/arex-common';
import {
  getLocalStorage,
  i18n,
  I18nextLng,
  SmallTextButton,
  SpaceBetweenWrapper,
  TooltipButton,
  useTranslation,
} from '@arextest/arex-core';
import { css } from '@emotion/react';
import { useRequest } from 'ahooks';
import {
  App,
  Button,
  Card,
  Col,
  Dropdown,
  Input,
  InputRef,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import CountUp from 'react-countup';

import { StatusTag } from '@/components';
import { EMAIL_KEY, PanesType } from '@/constant';
import { useNavPane } from '@/hooks';
import { ReportService, ScheduleService } from '@/services';
import { PlanItemStatistics, PlanStatistics } from '@/services/ReportService';
import { CreatePlanReq, MessageMap } from '@/services/ScheduleService';
import { useMenusPanes } from '@/store';
import IconLog from '~icons/octicon/log-24';

function getPercent(num: number, den: number, showPercentSign = true) {
  const value = num && den ? parseFloat(((num / den) * 100).toFixed(0)) : 0;
  return showPercentSign ? value + '%' : value;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'left',
    },
  },
} as const;

export type ReplayPlanItemProps = {
  appId: string;
  selectedPlan?: PlanStatistics;
  filter?: (record: PlanItemStatistics) => boolean;
  onRefresh?: () => void;
};

const PlanItem: FC<ReplayPlanItemProps> = (props) => {
  const { selectedPlan, filter, onRefresh } = props;
  const { message, notification } = App.useApp();
  const { activePane } = useMenusPanes();

  const { t } = useTranslation(['components', 'common']);
  const email = getLocalStorage<string>(EMAIL_KEY) as string;
  const navPane = useNavPane();
  const { token } = theme.useToken();

  const {
    data: planItemData = [],
    loading: loadingData,
    refresh,
    cancel: cancelPollingInterval,
  } = useRequest(
    () =>
      ReportService.queryPlanItemStatistics({
        planId: selectedPlan!.planId,
      }),
    {
      ready: !!selectedPlan?.planId,
      refreshDeps: [selectedPlan?.planId],
      loadingDelay: 200,
      pollingInterval: 6000,
      onSuccess(res) {
        if (res)
          res.every((record) => record.status !== 1) &&
            selectedPlan?.status !== 1 &&
            cancelPollingInterval();
        else cancelPollingInterval();
      },
    },
  );
  // optimize: cancel polling interval when pane is not active
  useEffect(() => {
    activePane?.id !== props.appId ? cancelPollingInterval() : refresh();
  }, [activePane, props.appId]);

  const planItemDataFiltered = useMemo(
    () => (filter ? planItemData?.filter(filter) : planItemData || []),
    [planItemData],
  );

  const countData = useMemo(
    () => [
      selectedPlan?.successCaseCount,
      selectedPlan?.failCaseCount,
      selectedPlan?.errorCaseCount,
      selectedPlan?.waitCaseCount,
    ],
    [selectedPlan],
  );

  const countSum = useMemo(() => countData.reduce((a, b) => (a || 0) + (b || 0), 0), [countData]);

  const pieProps = useMemo(
    () => ({
      data: {
        labels: [t('replay.passed'), t('replay.failed'), t('replay.invalid'), t('replay.blocked')],
        datasets: [
          {
            data: countData,
            backgroundColor: [
              token.colorSuccessTextHover,
              token.colorErrorTextHover,
              token.colorInfoTextHover,
              token.colorWarningTextHover,
            ],
          },
        ],
      },
      options: chartOptions,
    }),
    [countData],
  );

  const CaseCountRender = useCallback(
    (count: number, record: PlanItemStatistics, status?: 0 | 1 | 2) => (
      <Button
        type='link'
        size='small'
        onClick={() => {
          navPane({
            type: PanesType.REPLAY_CASE,
            id: record.planItemId,
            data: { ...record, filter: status },
          });
        }}
      >
        <CountUp
          preserveValue
          duration={0.3}
          end={count}
          style={{
            color:
              status === undefined
                ? token.colorText
                : [token.colorSuccessText, token.colorErrorText, token.colorInfoText][status],
          }}
        />
      </Button>
    ),
    [token],
  );

  const searchInput = useRef<InputRef>(null);
  const columns: ColumnsType<PlanItemStatistics> = [
    {
      title: t('replay.planItemID'),
      dataIndex: 'planItemId',
      key: 'planItemId',
      ellipsis: { showTitle: false },
      render: (value) => (
        <Tooltip placement='topLeft' title={value}>
          {value}
        </Tooltip>
      ),
    },
    {
      title: t('replay.api'),
      dataIndex: 'operationName',
      key: 'operationName',
      ellipsis: { showTitle: false },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
        <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
          <Input.Search
            allowClear
            enterButton
            size='small'
            ref={searchInput}
            placeholder={`${t('search', { ns: 'common' })} ${t('replay.api')}`}
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onSearch={(value, event) => {
              // @ts-ignore
              if (event.target?.localName === 'input') return;
              confirm();
            }}
            onPressEnter={() => confirm()}
          />
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? token.colorPrimaryActive : undefined }} />
      ),
      onFilter: (value, record) =>
        (record.operationName || '')
          .toString()
          .toLowerCase()
          .includes((value as string).toLowerCase()),
      onFilterDropdownOpenChange: (visible) => {
        visible && setTimeout(() => searchInput.current?.select(), 100);
      },
      render: (value) => (
        <Tooltip placement='topLeft' title={value}>
          {'/' + (value ?? '').split('/').at(-1)}
        </Tooltip>
      ),
    },
    {
      title: t('replay.state'),
      render: (_, record) => (
        <div style={{ overflow: 'hidden' }}>
          <StatusTag
            status={record.status}
            caseCount={record.successCaseCount + record.failCaseCount + record.errorCaseCount}
            totalCaseCount={record.totalCaseCount}
            message={record.errorMessage}
          />
        </div>
      ),
    },
    {
      title: t('replay.timeConsumed'),
      render: (_, record) =>
        record.replayEndTime && record.replayStartTime
          ? (record.replayEndTime - record.replayStartTime) / 1000
          : '-',
    },
    {
      title: t('replay.cases'),
      dataIndex: 'totalCaseCount',
      width: 72,
      render: (count, record) => CaseCountRender(count, record),
    },
    {
      title: t('replay.passed'),
      dataIndex: 'successCaseCount',
      width: 72,
      render: (count, record) => CaseCountRender(count, record, 0),
    },
    {
      title: t('replay.failed'),
      dataIndex: 'failCaseCount',
      width: 72,
      render: (count, record) => CaseCountRender(count, record, 1),
    },
    {
      title: t('replay.invalid'),
      dataIndex: 'errorCaseCount',
      width: 72,
      render: (count, record) => CaseCountRender(count, record, 2),
    },
    {
      title: t('replay.blocked'),
      dataIndex: 'waitCaseCount',
      width: 72,
      render: (text) => (
        <CountUp
          preserveValue
          duration={0.3}
          end={text}
          style={{ color: token.colorWarningText }}
        />
      ),
    },
    {
      title: t('replay.action'),
      align: 'center',
      render: (_, record) => (
        <>
          <TooltipButton
            icon={<ContainerOutlined />}
            title={t('replay.diffScenes')}
            breakpoint='xxl'
            disabled={!record.failCaseCount}
            color={record.failCaseCount ? 'primary' : 'disabled'}
            onClick={() => {
              navPane({
                type: PanesType.DIFF_SCENES,
                id: record.planItemId,
                data: record,
              });
            }}
          />
          <TooltipButton
            icon={<FileTextOutlined />}
            title={t('replay.case')}
            breakpoint='xxl'
            color='primary'
            onClick={() => {
              navPane({
                type: PanesType.REPLAY_CASE,
                id: record.planItemId,
                data: record,
              });
            }}
          />
          <TooltipButton
            icon={<RedoOutlined />}
            title={t('replay.rerun')}
            breakpoint='xxl'
            color='primary'
            onClick={() => handleRerun(1, [{ operationId: record.operationId }])}
          />
        </>
      ),
    },
  ];

  const { run: stopPlan } = useRequest(ScheduleService.stopPlan, {
    manual: true,
    ready: !!selectedPlan?.planId,
    onSuccess(success) {
      success
        ? message.success(t('message.success', { ns: 'common' }))
        : message.error(t('message.error', { ns: 'common' }));
    },
  });

  const { run: deleteReport } = useRequest(ReportService.deleteReport, {
    manual: true,
    ready: !!selectedPlan?.planId,
    onSuccess(success) {
      success
        ? message.success(t('message.success', { ns: 'common' }))
        : message.error(t('message.error', { ns: 'common' }));
    },
  });

  const [creatingPlan, setCreatingPlan] = useState<number>();
  const { run: rerun } = useRequest(ScheduleService.createPlan, {
    manual: true,
    onBefore([param]) {
      setCreatingPlan(param.replayPlanType);
    },
    onSuccess(res) {
      if (res.result === 1) {
        onRefresh?.();
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
    onError(e) {
      notification.error({
        message: t('replay.startFailed'),
        description: e.message,
      });
    },
    onFinally() {
      setCreatingPlan(undefined);
    },
  });

  const handleRerun = (
    replayPlanType: number,
    operationCaseInfoList?: { operationId: string; replayIdList?: string[] }[],
  ) => {
    if (selectedPlan?.caseStartTime && selectedPlan?.caseEndTime) {
      rerun({
        caseSourceFrom: selectedPlan.caseStartTime,
        caseSourceTo: selectedPlan.caseEndTime,
        appId: selectedPlan.appId,
        operator: email,
        sourceEnv: 'pro',
        targetEnv: selectedPlan!.targetEnv,
        operationCaseInfoList,
        replayPlanType,
      });
    } else {
      message.error(t('replay.parameterError'));
    }
  };

  const { run: retryPlan, loading: retrying } = useRequest(ScheduleService.reRunPlan, {
    manual: true,
    onSuccess(res) {
      if (res.result === 1) {
        message.success(t('message.success', { ns: 'common' }));
        onRefresh?.();
      } else {
        message.error(res.desc);
      }
    },
  });

  const [ReplayLogsDrawerOpen, setReplayLogsDrawerOpen] = useState(false);

  return selectedPlan ? (
    <Card
      bordered={false}
      size='small'
      title={`${t('replay.report')}: ${selectedPlan.planName}`}
      extra={
        <Space>
          <Popconfirm
            title={t('replay.terminateTheReplay')}
            description={t('replay.confirmTerminateReplay')}
            onConfirm={() => stopPlan(selectedPlan!.planId)}
          >
            <SmallTextButton
              color={'primary'}
              icon={<StopOutlined />}
              title={t('replay.terminate') as string}
            />
          </Popconfirm>

          <Popconfirm
            title={t('replay.deleteTheReport')}
            description={t('replay.confirmDeleteReport')}
            onConfirm={() => deleteReport(selectedPlan!.planId)}
          >
            <SmallTextButton
              color={'primary'}
              icon={<DeleteOutlined />}
              title={t('replay.delete') as string}
            />
          </Popconfirm>

          {/*logs*/}
          <SmallTextButton
            onClick={() => {
              setReplayLogsDrawerOpen(true);
            }}
            color={'primary'}
            icon={<Icon component={IconLog} />}
            title={t('replay.logs') as string}
          />

          <SmallTextButton
            title={t('replay.retry') as string}
            icon={<RedoOutlined />}
            color={'primary'}
            loading={retrying}
            onClick={() => retryPlan({ planId: selectedPlan!.planId })}
          />

          <SmallTextButton
            title={t('replay.rerun') as string}
            icon={<RedoOutlined />}
            color={'primary'}
            loading={creatingPlan === 0}
            onClick={() =>
              handleRerun(
                1,
                planItemData?.map((item) => ({ operationId: item.operationId })),
              )
            }
          />
        </Space>
      }
    >
      <Row gutter={12}>
        <Col span={12}>
          <Typography.Text type='secondary'>{t('replay.basicInfo')}</Typography.Text>
          <div
            css={css`
              display: flex;
              & > * {
                flex: 1;
              }
            `}
          >
            <Statistic
              title={t('replay.passRate')}
              value={getPercent(selectedPlan.successCaseCount, selectedPlan.totalCaseCount)}
            />
            <Statistic
              title={t('replay.apiPassRate')}
              value={getPercent(
                selectedPlan.successOperationCount,
                selectedPlan.totalOperationCount,
              )}
            />
          </div>
          <div>
            {t('replay.reportId')}: {selectedPlan.planId}
          </div>
          <div>
            {t('replay.reportName')}: {selectedPlan.planName}
          </div>
          <div>
            {t('replay.caseRange')}:{' '}
            {dayjs(new Date(selectedPlan.caseStartTime || '')).format('YYYY/MM/DD')} -{' '}
            {dayjs(new Date(selectedPlan.caseEndTime || '')).format('YYYY/MM/DD')}
          </div>
          <div>
            {t('replay.targetHost')}: {selectedPlan.targetEnv}
          </div>
          <div>
            {t('replay.executor')}: {selectedPlan.creator}
          </div>
          <div>
            <span>
              {t('replay.recordVersion')}: {selectedPlan.caseRecordVersion || '-'}
            </span>
            &nbsp;
            <span>
              {t('replay.replayVersion')}: {selectedPlan.coreVersion || '-'}
            </span>
          </div>
        </Col>

        <Col span={12}>
          <Typography.Text type='secondary'>{t('replay.replayPassRate')}</Typography.Text>
          <SpaceBetweenWrapper>
            <div style={{ height: '180px', width: 'calc(100% - 160px)', padding: '16px 0' }}>
              <Pie {...pieProps} />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                width: '160px',
                padding: '16px 16px 16px 0',
              }}
            >
              <div>
                {t('replay.totalCases')}: {countSum}
              </div>
              <div>
                {t('replay.passed')}: {countData[0]}
              </div>
              <div>
                {t('replay.failed')}: {countData[1]}
              </div>
              <div>
                {t('replay.invalid')}: {countData[2]}
              </div>
              <div>
                {t('replay.blocked')}: {countData[3]}
              </div>
            </div>
          </SpaceBetweenWrapper>
        </Col>
      </Row>

      <br />

      <Table
        size='small'
        rowKey='planItemId'
        loading={loadingData}
        columns={columns}
        dataSource={planItemDataFiltered}
      />
      <ReplayLogsDrawer
        planId={selectedPlan?.planId}
        open={ReplayLogsDrawerOpen}
        request={ScheduleService.queryLogs}
        onClose={() => {
          setReplayLogsDrawerOpen(false);
        }}
      />
    </Card>
  ) : null;
};

export default PlanItem;
